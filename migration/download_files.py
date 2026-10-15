"""Download every uploaded file referenced by the 76 agencyas province sites.

Usage:  python download_files.py [--estimate]
Reads   ../crawl/raw/*.html
Writes  files/{slug}/{filename}          province uploads
        files/_central/{host}/{path}     shared content (gdhelppage / gdcatalog)
        manifest.json                    one row per URL: local path, size, sha256, status
Safe to re-run: files already downloaded with a matching size are skipped.
"""
import concurrent.futures as cf, glob, hashlib, json, os, random, re, sys, time, urllib.parse, urllib.request

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'crawl', 'raw')
OUT = os.path.join(HERE, 'files')
MANIFEST = os.path.join(HERE, 'manifest.json')
UA = {'User-Agent': 'Mozilla/5.0'}
UPLOAD = re.compile(r'https://agencyas\.gdcatalog\.go\.th/uploads/content/([^/"\'#\s]+)/([^"\'#\s<>]+)')
CENTRAL = re.compile(r'https://(gdhelppage\.gdcatalog\.go\.th/data/[^"\'#\s<>]+|gdcatalog\.go\.th/assets/images/nso_indicators/[^"\'#\s<>]+'
                     r'|agencyas\.gdcatalog\.go\.th/application/views/area-catalog-v2/assets/meeting_files/[^"\'#\s<>]+)')


def collect():
    jobs = {}
    for fn in sorted(glob.glob(os.path.join(RAW, '*.html'))):
        h = open(fn, encoding='utf-8', errors='replace').read()
        h = re.sub(r'<!--.*?-->', '', h, flags=re.S)
        for m in UPLOAD.finditer(h):
            jobs[m.group(0)] = os.path.join(m.group(1), urllib.parse.unquote(m.group(2)).replace('/', '_'))
        for m in CENTRAL.finditer(h):
            jobs[m.group(0)] = os.path.join('_central', *urllib.parse.unquote(m.group(1)).split('/'))
    return jobs


def quote(url):
    p = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit(p._replace(path=urllib.parse.quote(urllib.parse.unquote(p.path))))


def head(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(quote(url), headers=UA, method='HEAD'), timeout=60) as r:
            return int(r.headers.get('Content-Length') or 0)
    except Exception:
        return None


def fetch(job):
    url, rel = job
    dst = os.path.join(OUT, rel)
    row = dict(url=url, path=os.path.join('files', rel).replace('\\', '/'))
    err = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(quote(url), headers=UA), timeout=300) as r:
                expected = int(r.headers.get('Content-Length') or 0)
                ctype = r.headers.get('Content-Type', '')
                if os.path.exists(dst) and expected and os.path.getsize(dst) == expected:
                    data = open(dst, 'rb').read()
                else:
                    data = r.read()
                    if expected and len(data) != expected:
                        raise IOError(f'short read {len(data)}/{expected}')
                    os.makedirs(os.path.dirname(dst), exist_ok=True)
                    with open(dst + '.part', 'wb') as f:
                        f.write(data)
                    os.replace(dst + '.part', dst)
            row.update(status='ok', size=len(data), content_type=ctype, sha256=hashlib.sha256(data).hexdigest(),
                       magic_ok=(not dst.lower().endswith('.pdf')) or data[:5] == b'%PDF-')
            return row
        except Exception as e:
            err = repr(e)
            if 'HTTP Error 404' in err:
                break
            time.sleep(3 * (attempt + 1))
    row.update(status='error', error=err)
    return row


def main():
    jobs = collect()
    print(len(jobs), 'distinct URLs')
    if '--estimate' in sys.argv:
        sample = random.Random(1).sample(sorted(jobs), 80)
        with cf.ThreadPoolExecutor(4) as ex:
            sizes = [s for s in ex.map(head, sample) if s]
        avg = sum(sizes) / len(sizes)
        print(f'sample {len(sizes)}/80 ok, avg {avg/1e6:.2f} MB, max {max(sizes)/1e6:.1f} MB, est total {avg*len(jobs)/1e9:.2f} GB')
        return
    rows, done = [], 0
    with cf.ThreadPoolExecutor(4) as ex:
        for row in ex.map(fetch, sorted(jobs.items())):
            rows.append(row)
            done += 1
            if done % 100 == 0:
                print(done, '/', len(jobs), 'errors', sum(r['status'] != 'ok' for r in rows), flush=True)
                json.dump(rows, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(rows, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    bad = [r for r in rows if r['status'] != 'ok']
    print('done', len(rows), 'ok', len(rows) - len(bad), 'errors', len(bad),
          'bytes', sum(r.get('size', 0) for r in rows), 'bad-pdf', sum(1 for r in rows if r.get('magic_ok') is False))
    for r in bad:
        print('ERR', r['url'], r['error'])


if __name__ == '__main__':
    main()
