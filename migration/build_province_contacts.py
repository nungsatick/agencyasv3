"""
Office contact details of the 76 provincial statistics offices, from the NSO intranet phonebook
(https://phonebook.nso.go.th/provincial.php, reachable only on the office VPN).

Keeps only what the site footer shows about the OFFICE: address, office phone, fax and the
office e-mail ending in @nso.mail.go.th. Staff names and mobile numbers are not copied.

    python migration/build_province_contacts.py <saved provincial.php>
    -> migration/import/province_contacts.json
"""
import html
import io
import json
import re
import sys
from pathlib import Path

src = Path(sys.argv[1]).read_text(encoding='utf-8')
here = Path(__file__).parent
provinces = json.loads((here / 'import' / 'provinces.json').read_text(encoding='utf-8'))
by_name = {p['name_th']: p for p in provinces}


def text(fragment: str) -> str:
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', fragment))).strip()


# the page writes attributes in single quotes; make them double so one set of patterns fits
src = src.replace("'", '"')
cards = re.split(r'<div class="province-card', src)[1:]
out, problems = [], []
for card in cards:
    title = re.search(r'class="province-title">(.*?)</span>', card, re.S)
    if not title:  # the page also has other blocks whose class starts with "province-card"
        continue
    name = text(title.group(1))
    phone = re.search(r'fa-phone[^>]*></i>(.*?)</span>', card, re.S)
    fax = re.search(r'fa-print[^>]*></i>(.*?)</span>', card, re.S)
    rows = dict(
        (text(lab), text(val))
        for lab, val in re.findall(r'<td class="detail-label">(.*?)</td>\s*<td class="detail-value">(.*?)</td>', card, re.S)
    )
    emails = [e for e in re.split(r'[,\s]+', rows.get('Email', '')) if '@' in e]
    office_mail = next((e for e in emails if e.lower().endswith('@nso.mail.go.th')), None)
    clean = lambda v: None if not v or v.strip() in ('-', '') else v.strip()
    p = by_name.get(name)
    if not p:
        problems.append(f'{name}: not one of the 76 provinces')
        continue
    if not office_mail:
        problems.append(f'{name}: no @nso.mail.go.th address in the phonebook (left as it is)')
    out.append({
        'slug': p['slug'],
        'name_th': name,
        'address': clean(rows.get('ที่อยู่')),
        'phone': clean(text(phone.group(1)) if phone else None),
        'fax': clean(text(fax.group(1)) if fax else None),
        'email': office_mail,
    })

missing = sorted(set(by_name) - {o['name_th'] for o in out})
for m in missing:
    problems.append(f'{m}: not found in the phonebook')
dest = here / 'import' / 'province_contacts.json'
dest.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
print(f'{len(out)} offices -> {dest}')
for p in problems:
    print('  !', p)
