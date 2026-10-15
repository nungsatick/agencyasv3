"""Turn the shared (central) sections 1-2 of the legacy docs page into rows for central_contents.

Usage:  python build_central.py
Writes  import/central_contents.json
The central sections are identical on all 76 sites, so one page is enough.
"""
import html, json, os, re, sys

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
page = open(os.path.join(HERE, '..', 'crawl', 'raw', 'smprakan__docs.html'), encoding='utf-8', errors='replace').read()
page = re.sub(r'<!--.*?-->', '', page, flags=re.S)
body = page[page.find('class="docs-content"'):]
manifest = {r['url']: r for r in json.load(open(os.path.join(HERE, 'manifest.json'), encoding='utf-8'))}


def txt(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()


def parse(block, section, year, slug, title, order):
    ref = re.search(r'<div class="reference">.*?href="([^"]+)"', block, re.S)
    rows = [(txt(t), u) for u, t in re.findall(r'<td><a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', block, re.S)]
    embedded = re.findall(r'<(?:img|embed)[^>]*src="([^"#]+)', block)
    paras = [txt(p) for p in re.findall(r'<p>(.*?)</p>', block, re.S)]
    return dict(
        section=section, fiscal_year=year, slug=slug, title=title, sort_order=order, status='published',
        body='\n\n'.join(p for p in paras if p) or None,
        source_url=ref.group(1) if ref and ref.group(1) not in embedded else None,
        # files shown inline (infographic / embedded PDF), in page order
        files=[dict(legacy_url=u, local_path=manifest[u]['path']) for u in embedded],
        # numbered list of links; local_path is set when the target is a file we downloaded
        links=[dict(title=t, url=u, local_path=manifest[u]['path'] if u in manifest else None) for t, u in rows])


out = []
for art in re.finditer(r'<article class="docs-article" id="(section-[12](?:-\d+)?)">(.*?)</article>', body, re.S):
    art_id, art_html = art.groups()
    section = 'plan' if art_id.startswith('section-1') else 'howto'
    year = int(art_id.split('-')[2]) if art_id.count('-') == 2 else (2565 if section == 'plan' else None)
    art_title = txt(re.search(r'<h1[^>]*>(.*?)</h1>', art_html, re.S).group(1).split('<span')[0])
    intro = re.search(r'<section class="docs-intro"[^>]*>(.*?)</section>', art_html, re.S)
    order = 0
    if intro and txt(intro.group(1)):
        out.append(parse(intro.group(1), section, year, 'intro', art_title, order))
    for m in re.finditer(r'<section class="docs-section" id="(item-[\d\-]+)">(.*?)</section>', art_html, re.S):
        order += 1
        title = txt(re.search(r'<h2[^>]*>(.*?)</h2>', m.group(2), re.S).group(1))
        out.append(parse(re.sub(r'<h2.*?</h2>', '', m.group(2), flags=re.S), section, year, m.group(1), title, order))

json.dump(out, open(os.path.join(HERE, 'import', 'central_contents.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
used = {f['legacy_url'] for r in out for f in r['files']} | {l['url'] for r in out for l in r['links'] if l['local_path']}
central = {u for u, r in manifest.items() if '/_central/' in r['path'] and 'meeting_files' not in u}
print('rows', len(out), '| files', sum(len(r['files']) for r in out), '| links', sum(len(r['links']) for r in out),
      '| central files not referenced', len(central - used))
for r in out:
    print(r['section'], r['fiscal_year'], r['slug'], '|', r['title'], '| files', len(r['files']), 'links', len(r['links']), '| src', bool(r['source_url']))
