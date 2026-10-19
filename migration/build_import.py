"""Map the legacy crawl (../crawl/sites.json + manifest.json) onto the new schema (schema.sql).

Usage:  python build_import.py
Writes  import/provinces.json, files.json, documents.json, dashboards.json, central_files.json
Rows reference each other by natural keys (province slug, file legacy_url) so the
loader can assign real ids on insert.
"""
import collections, json, os, re, sys
from urllib.parse import urlparse

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'import')
sites = json.load(open(os.path.join(HERE, '..', 'crawl', 'sites.json'), encoding='utf-8'))
manifest = {r['url']: r for r in json.load(open(os.path.join(HERE, 'manifest.json'), encoding='utf-8'))}

TOPICS = [  # first match wins
    ('elderly', r'สูงอายุ|สุงอายุ|สูงวัย'),
    ('tourism', r'ท่องเที่ยว'),
    ('waste', r'ขยะ'),
    ('health', r'สุขภาพ|สาธารณสุข|โรค|pm\s*2|ฝุ่น|หมอกควัน'),
    ('disaster', r'สาธารณภัย|สาธารภัย|ภัยพิบัติ|อุทกภัย|ภัยแล้ง|วาตภัย|อัคคีภัย|ไฟป่า|น้ำท่วม|ดินถล่ม'),
    ('water', r'น้ำ|น้ํา'),
    ('agriculture', r'เกษตร|ข้าว|ยาง|ทุเรียน|ปาล์ม|มันสำปะหลัง|อ้อย|โค|ผลไม้|ประมง|พืช|มะม่วง|มะพร้าว|ลำไย|กาแฟ|สับปะรด|ส้มโอ|ปลา|กุ้ง|ปศุสัตว์'),
    ('safety', r'อุบัติเหตุ|ปลอดภัย|ยาเสพติด'),
    ('education', r'ศึกษา|เด็ก|เยาวชน'),
    ('environment', r'สิ่งแวดล้อม|ป่า|ทรัพยากรธรรมชาติ'),
    ('economy', r'ยากจน|รายได้|เศรษฐกิจ|การค้า|อุตสาหกรรม|sme|otop|งบประมาณ|การเงิน|การคลัง|ผ้า'),
    ('province_overview', r'ศูนย์ข้อมูล|ตัวชี้วัด|command center|สารสนเทศจังหวัด|สถิติทางการ|แผนพัฒนา'),
]


def topic_of(title):
    t = title.lower()
    for slug, pat in TOPICS:
        if re.search(pat, t):
            return slug
    return None


def classify(title, nav_section):
    """Return (type_code, needs_review)."""
    t = title.lower()
    m = re.search(r'(?:te?a?mplate|เทมเพลต)\s*([123๑๒๓])', t)
    if m:
        return ('template1_dataset', 'template2_metadata', 'template3_resource')['123๑๒๓'.index(m.group(1)) % 3], False
    if re.search(r'm[ae]ta\s*data|เมทาดาตา', t):
        return 'template2_metadata', False
    if re.search(r'resource', t):
        return 'template3_resource', False
    if 'คำสั่ง' in t or 'แต่งตั้งคณะกรรมการ' in t:
        return 'committee_order', False
    if re.search(r'powerpoint|ระเบียบวาระ|เอกสารประกอบ|สไลด์', t) and 'ประชุม' in t:
        return 'meeting_material', False
    if 'ประชุม' in t or re.match(r'^[\s\-]*ครั้งที่', t):
        return 'meeting_report', False
    if 'สถิติทางการ' in t:
        return 'official_stat_list', False
    if 'แผนพัฒนาสถิติ' in t:
        return 'stat_plan', False
    if 'บัญชีข้อมูล' in t:
        return 'digital_catalog', False
    if 'ข้อกำหนด' in t:
        return 'analysis_spec', False
    if 'บทวิเคราะห์' in t:
        return 'analysis_spec', False
    if nav_section == 'section-4':
        return 'analysis_spec', False
    return 'other', True


def provider_of(url):
    host = urlparse(url).netloc
    if 'powerbi' in host:
        return 'powerbi'
    if 'arcgis' in url or 'smcgis' in host:
        return 'arcgis'
    if 'lookerstudio' in host or 'datastudio' in host:
        return 'looker'
    return 'other'


# legacy slug -> 3-letter province code; the seal for each province is ../web/public/logos/{CODE}.png
_codes = ("smprakan SPK nknayok NYK amnatchr ACR bungkan BKN lampang LPG phrae PRE kpphet KPT smsakhon SKN krabi KBI phangnga PNA phuket PKT ranong RNG satun STN trang TRG sisaket SSK phayao PYO phetburi PBI uttaradit UTT nkrat NMA khkaen KKN chrai CRI angthong ATG lopburi LRI singburi SBR chainat CNT pchburi PRI buriram BRM surin SRN ubon UBN yasothon YST nongkhai NKI kalasin KSN sakonnk SNK nkphanom NPM maehson MSN tak TAK skhothai STI ratburi RBR smskhram SKM pchkkhan PKN nksitham NST surat SNI chumphon CPN songkhla SKA phatlung PLG yala YLA naratwat NWT nkpathom NPT trat TRT chchsao CCO lamphun LPN nksawan NSN ptthani PTE ayuttaya AYA nblamphu NBP nan NAN pattani PTN roiet RET phichit PCT nontburi NBI saraburi SRI suphan SPB chonburi CBI mukdahan MDH udon UDN chyaphum CPM chtburi CTI kcnburi KRI rayong RYG sakaeo SKW loei LEI sarakham MKM uthai UTI phchabun PNB chmai CMI psnulok PLK").split()
PROVINCE_CODE = dict(zip(_codes[::2], _codes[1::2]))
LOGO_DIR = os.path.join(HERE, '..', 'web', 'public', 'logos')

provinces, files, documents, dashboards = [], {}, [], []


def use_file(url):
    m = manifest[url]
    files.setdefault(url, dict(legacy_url=url, local_path=m['path'], original_name=os.path.basename(m['path']),
                               mime_type=m['content_type'], size_bytes=m['size'], sha256=m['sha256']))
    return url


for s in sites:
    other = s['contact_other']
    phone = re.search(r'โทรศัพท์\s*([^โ]*?)(?=\s*โทรสาร|\s*[\w.\-]+@|$)', other)
    fax = re.search(r'โทรสาร\s*(.*?)(?=\s*[\w.\-]+@|$)', other)
    web = re.search(r'https?://\S+', other)
    addr = s['contact_addr']
    office = re.match(r'(สำนักงานสถิติจังหวัด\S+)\s*(.*)', addr)
    provinces.append(dict(slug=s['slug'], name_th=s['province'], ckan_url=s['catalog_url'],
                          office_name=office.group(1) if office else None,
                          address=office.group(2) if office else addr,
                          phone=phone.group(1).strip() if phone else None,
                          fax=fax.group(1).strip() if fax else None,
                          email=s['email'] or None, website=web.group(0) if web else None,
                          code=PROVINCE_CODE[s['slug']], logo_path=f"web/public/logos/{PROVINCE_CODE[s['slug']]}.png"))
    assert os.path.exists(os.path.join(LOGO_DIR, PROVINCE_CODE[s['slug']] + '.png')), s['slug']
    issue = None  # (year, title) of the last file-less heading item; the templates after it belong to that issue
    for order, i in enumerate(s['doc_items']):
        title = re.sub(r'^[\s\-–]+|[\s\-–]+$', '', i['title'])
        type_code, review = classify(title, i['nav_section'])
        mt = re.search(r'ครั้งที่\s*(\d+)\s*/\s*(\d{4})', title)
        refs = list(dict.fromkeys(u for u in i['files'] + i['embeds'] if u.startswith('http')))
        # The old backoffice shows a shared placeholder PDF when nothing was uploaded.
        urls = [u for u in refs if '/uploads/content/' in u]
        external = [u for u in refs if 'agencyas.gdcatalog.go.th' not in u]
        empty = not urls and not external
        is_template = type_code.startswith('template')
        issue_title = None
        if empty and title and type_code in ('other', 'analysis_spec') and i['nav_section'] == 'section-3':
            issue = (i['nav_year'], title)
        elif is_template and issue and issue[0] == i['nav_year']:
            issue_title = issue[1]
        elif not is_template:
            issue = None
        meeting = type_code in ('committee_order', 'meeting_report', 'meeting_material')
        documents.append(dict(
            legacy_id=i['id'], province=s['slug'], fiscal_year=int(i['nav_year']), type_code=type_code,
            topic=None if meeting else topic_of(title) or (topic_of(issue_title) if issue_title else None),
            title=title or None, description=i['desc'] or None, issue_title=issue_title,
            external_url=external[0] if external else None,
            meeting_no=int(mt.group(1)) if mt else None, sort_order=order,
            status='draft' if empty else 'published',
            legacy_title=i['title'], legacy_no_file=empty, needs_review=review or not title or empty,
            files=[use_file(u) for u in urls]))
    for order, u in enumerate(s['util_items']):
        title = re.sub(r'^[\s\-–"“”]+|[\s\-–"“”]+$', '', u['title'])
        embed = u['iframe'][0] if u['iframe'] else None
        attach = [x for x in u['links'] if '/uploads/content/' in x]
        extra = [x for x in u['links'] if x != embed and x not in attach and x.split('&')[0] != (embed or '').split('&')[0]]
        topic = topic_of(title)
        dashboards.append(dict(
            legacy_id=u['id'], province=s['slug'], fiscal_year=int(u['year']) if u['year'] else None,
            topic=topic, title=title or None, description=u['desc'] or None,
            provider=provider_of(embed) if embed else 'none', embed_url=embed,
            sort_order=order, status='published', legacy_title=u['title'],
            legacy_extra_links=extra, needs_review=not title or not embed or topic is None or not u['year'],
            files=[use_file(x) for x in attach]))

central = [dict(legacy_url=r['url'], local_path=r['path'], mime_type=r['content_type'], size_bytes=r['size'], sha256=r['sha256'])
           for r in manifest.values() if '/_central/' in r['path']]

os.makedirs(OUT, exist_ok=True)
for name, rows in [('provinces', provinces), ('files', list(files.values())), ('documents', documents),
                   ('dashboards', dashboards), ('central_files', central)]:
    json.dump(rows, open(os.path.join(OUT, name + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{name}: {len(rows)}')

C = collections.Counter
print('document types:', C(d['type_code'] for d in documents).most_common())
print('documents needing review:', sum(d['needs_review'] for d in documents),
      '| no file (draft):', sum(d['legacy_no_file'] for d in documents),
      '| with issue_title:', sum(bool(d['issue_title']) for d in documents),
      '| external link:', sum(bool(d['external_url']) for d in documents))
print('document topics:', C(d['topic'] for d in documents if d['type_code'].startswith(('template', 'analysis'))).most_common())
print('dashboard topics:', C(d['topic'] for d in dashboards).most_common())
print('dashboards needing review:', sum(d['needs_review'] for d in dashboards))
print('unused province files:', sum(1 for u, r in manifest.items() if '/_central/' not in r['path'] and u not in files))
print('provinces missing phone/office:', [p['slug'] for p in provinces if not p['phone'] or not p['office_name']])
