"""Generate editable draw.io ER pages from the registered Payload schema snapshot.

Run from any directory: python docs/build_er_diagram.py
No database connection or third-party packages required.
"""
from pathlib import Path
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / 'web/src/migrations'
registered = re.findall(r"name:\s*'([^']+)'", (MIGRATIONS / 'index.ts').read_text(encoding='utf-8'))
source = MIGRATIONS / (registered[-1] + '.json')
schema = json.loads(source.read_text(encoding='utf-8'))
tables = {v['name']: v for v in schema['tables'].values()}
groups = [
    ('01 Content & provinces', 'เนื้อหาและข้อมูลจังหวัด', '#dbeafe', ['provinces', 'topics', 'document_types', 'documents', 'documents_rels', 'files', 'dashboards', 'dashboards_rels']),
    ('02 Users & security', 'ผู้ใช้ สิทธิ์ และเซสชัน', '#ede9fe', ['users', 'users_rels', 'user_tokens', 'users_sessions', 'users_recovery_codes', 'session_activity']),
    ('03 Shared content', 'เนื้อหากลางและประกาศ', '#dcfce7', ['central_contents', 'central_contents_links', 'central_contents_rels', 'announcements', 'announcements_rels']),
    ('04 Analytics & audit', 'สถิติและประวัติการใช้งาน', '#ffedd5', ['page_views', 'hit_counts', 'activity_logs', 'cookie_consents']),
    ('05 Content versions', 'ประวัติเนื้อหาที่ Payload จัดเก็บ', '#fce7f3', ['_documents_v', '_documents_v_rels', '_dashboards_v', '_dashboards_v_rels', '_announcements_v', '_announcements_v_rels']),
    ('06 Payload internals', 'ตารางภายในของ Payload CMS', '#e2e8f0', ['payload_kv', 'payload_locked_documents', 'payload_locked_documents_rels', 'payload_preferences', 'payload_preferences_rels', 'payload_migrations']),
    ('07 Site settings', 'การตั้งค่าเว็บไซต์และนโยบาย', '#ccfbf1', ['site_settings', 'site_settings_footer_links']),
]
owner = {n: title for title, _, _, names in groups for n in names}
assert set(owner) == set(tables), 'Update page groups for new schema tables'
mx = ET.Element('mxfile', host='app.diagrams.net', agent='Codex', version='24.7.17', type='device')
edge_count = 0

for page_index, (title, subtitle, color, names) in enumerate(groups):
    diagram = ET.SubElement(mx, 'diagram', id=f'page-{page_index+1}', name=title)
    model = ET.SubElement(diagram, 'mxGraphModel', dx='1800', dy='1100', grid='1', gridSize='10', guides='1', tooltips='1', connect='1', arrows='1', fold='1', page='0', pageScale='1', pageWidth='2200', pageHeight='1800', math='0', shadow='0')
    root = ET.SubElement(model, 'root')
    ET.SubElement(root, 'mxCell', id='0')
    ET.SubElement(root, 'mxCell', id='1', parent='0')
    counter = [0]

    def cell(value, x, y, w, h, style, parent='1', ident=None):
        counter[0] += 1
        ident = ident or f'c{counter[0]}'
        c = ET.SubElement(root, 'mxCell', id=ident, value=value, style=style, vertex='1', parent=parent)
        ET.SubElement(c, 'mxGeometry', x=str(x), y=str(y), width=str(w), height=str(h), **{'as': 'geometry'})
        return ident

    text_style = 'text;html=0;align=left;verticalAlign=middle;whiteSpace=wrap;fontFamily=Tahoma;fontColor=#334155;'
    cell('AGENCYAS V3  |  ' + subtitle, 40, 20, 1800, 45, text_style + 'fontSize=26;fontStyle=1;')
    note = ('Physical ER • Source: ' + source.name + '\n'
            'PK = primary key   FK = foreign key   UQ = unique index   NN = NOT NULL (database)\n'
            'Solid arrow: child FK → parent key; label gives parents per child. Dashed arrow: application reference, not a database FK.\n'
            'Grey cards repeat referenced tables from other pages. Full columns appear once on their owning page.\n'
            'Draft-enabled fields can be nullable in PostgreSQL even when required by the application. Snapshot-based; live DB not inspected.')
    cell(note, 40, 75, 1800, 125, text_style + 'fontSize=13;')
    refs = sorted({f['tableTo'] for n in names for f in tables[n]['foreignKeys'].values()} - set(names))
    logical = []
    if 'session_activity' in names:
        logical.append(('session_activity', 'user_id', 'users', 'user_id → users.id (no FK)'))
    if 'hit_counts' in names:
        for target, kinds in [('files', 'file_view / file_download'), ('documents', 'doc_link'), ('dashboards', 'dashboard_view')]:
            logical.append(('hit_counts', 'ref_id', target, kinds + ': ref_id → id (no FK)'))
            if target not in refs:
                refs.append(target)

    row_ids = {}
    y = 240
    width = 420
    row_h = 25
    for offset in range(0, len(names), 3):
        heights = []
        for col, name in enumerate(names[offset:offset+3]):
            table = tables[name]
            fks = {c for f in table['foreignKeys'].values() for c in f['columnsFrom']}
            unique = [', '.join(c['expression'] for c in i['columns']) for i in table['indexes'].values() if i.get('isUnique')]
            height = 38 + row_h * len(table['columns']) + (24 * len(unique))
            heights.append(height)
            box = cell(name, 40 + col * 560, y, width, height,
                       f'swimlane;html=0;startSize=38;horizontal=1;rounded=1;arcSize=6;fillColor={color};swimlaneFillColor=#ffffff;strokeColor=#94a3b8;fontFamily=Tahoma;fontSize=16;fontStyle=1;align=left;spacingLeft=12;', ident='t-' + name)
            for i, (field, data) in enumerate(table['columns'].items()):
                flags = [flag for condition, flag in [(data.get('primaryKey'), 'PK'), (field in fks, 'FK'), (data.get('notNull'), 'NN')] if condition]
                datatype = data['type'].replace('timestamp(3) with time zone', 'timestamptz').replace('character varying', 'varchar')
                if datatype.startswith('enum_'):
                    datatype = 'enum'
                label = ('/'.join(flags) + '  ' if flags else '') + field + ' : ' + datatype
                row_ids[(name, field)] = cell(label, 0, 38+i*row_h, width, row_h,
                    'text;html=0;align=left;verticalAlign=middle;spacingLeft=10;fontFamily=Tahoma;fontSize=12;fontColor=#0f172a;overflow=hidden;', parent=box)
            for j, uq in enumerate(unique):
                cell('UQ (' + uq + ')', 0, 38 + len(table['columns'])*row_h + j*24, width, 24,
                     text_style + 'fontSize=11;fontColor=#7c3aed;spacingLeft=10;', parent=box)
        y += max(heights) + 150

    for i, name in enumerate(refs):
        ref = cell(name + '\nReference • ' + owner[name], 1740, 240 + i*135, 420, 95,
                   'rounded=1;html=0;whiteSpace=wrap;align=left;spacingLeft=12;fillColor=#f1f5f9;strokeColor=#94a3b8;fontFamily=Tahoma;fontSize=13;', ident='t-' + name)
        row_ids[(name, 'id')] = ref

    def edge(child, field, parent, parent_field, label, dashed=False):
        global edge_count
        edge_count += 1
        c = ET.SubElement(root, 'mxCell', id=f'e{edge_count}', value=label, edge='1', parent='1',
            source=row_ids[(child, field)], target=row_ids.get((parent, parent_field), 't-' + parent),
            style='edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=25;html=0;endArrow=block;endFill=1;strokeWidth=1.2;fontFamily=Tahoma;fontSize=10;labelBackgroundColor=#ffffff;' +
                  ('dashed=1;strokeColor=#d97706;fontColor=#92400e;' if dashed else 'strokeColor=#64748b;fontColor=#334155;'))
        ET.SubElement(c, 'mxGeometry', relative='1', **{'as': 'geometry'})

    for name in names:
        for fk in tables[name]['foreignKeys'].values():
            fields = fk['columnsFrom']
            cardinality = '1' if all(tables[name]['columns'][f]['notNull'] for f in fields) else '0..1'
            edge(name, fields[0], fk['tableTo'], fk['columnsTo'][0], ', '.join(fields) + ' → ' + cardinality + ' parent')
    for child, field, parent, label in logical:
        edge(child, field, parent, 'id', label, True)

    extra = []
    if 'files' in names:
        extra.append('files.version_of_id is a self-reference for file versions. history is a reverse join, not an extra column.\n*_rels tables implement multi-value relationships; path identifies the relationship field.')
    if 'hit_counts' in names:
        extra.append('hit_counts uses (kind, ref_id) to select its target table; no FK enforces the target.\ncookie_consents.visitor_id is anonymous text, not a users foreign key. No relationship to users is implied.')
    if 'session_activity' in names:
        extra.append('session_activity.user_id is numeric, not a declared relationship. users_sessions is separately managed by Payload.\nAuthentication columns (hash/salt/etc.) and recovery-code hashes are schema metadata only; no secret values are included.')
    if 'site_settings' in names:
        extra.append('site_settings is a Payload Global (singleton in application semantics). policy_version is a version number, not a foreign key.')
    if extra:
        cell('\n'.join(extra), 40, y, 1600, 90, text_style + 'fontSize=13;')

out = ROOT / 'docs/agencyasv3-er.drawio'
ET.indent(mx, space='  ')
ET.ElementTree(mx).write(out, encoding='utf-8', xml_declaration=True)
# Validate all diagram IDs and connection endpoints before delivery.
parsed = ET.parse(out)
for page in parsed.findall('.//diagram'):
    cells = page.findall('.//mxCell')
    ids = [c.get('id') for c in cells]
    assert len(ids) == len(set(ids))
    for c in cells:
        for attr in ('parent', 'source', 'target'):
            if c.get(attr):
                assert c.get(attr) in ids, (page.get('name'), attr, c.get(attr))
fk_count = sum(len(t['foreignKeys']) for t in tables.values())
assert edge_count == fk_count + 4
print(f'Created {out}: {len(groups)} pages, {len(tables)} full tables, {fk_count} foreign keys + 4 logical references; XML validation passed.')
