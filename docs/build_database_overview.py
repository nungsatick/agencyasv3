"""Readable database overview; full physical details remain in agencyasv3-er.drawio."""
from pathlib import Path
import json, html, math
import xml.etree.ElementTree as E
from PIL import Image, ImageDraw, ImageFont

OUT=Path(__file__).resolve().parent
schema=json.loads((OUT.parent/'web/src/migrations/20261014_143408_idle_sessions.json').read_text(encoding='utf-8'))
tables={t['name']:t for t in schema['tables'].values()}
W,H=2200,1770
img=Image.new('RGB',(W,H),'#f8fafc'); d=ImageDraw.Draw(img)
svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}"><rect width="100%" height="100%" fill="#f8fafc"/>']
mx=E.Element('mxfile',host='app.diagrams.net',type='device'); page=E.SubElement(mx,'diagram',name='Database overview',id='database')
model=E.SubElement(page,'mxGraphModel',grid='1',page='1',pageWidth=str(W),pageHeight=str(H)); root=E.SubElement(model,'root')
E.SubElement(root,'mxCell',id='0'); E.SubElement(root,'mxCell',id='1',parent='0')
n=1
def cell(value,x,y,w,h,style):
    global n
    n+=1
    c=E.SubElement(root,'mxCell',id=str(n),value=value,style=style,vertex='1',parent='1')
    E.SubElement(c,'mxGeometry',x=str(x),y=str(y),width=str(w),height=str(h),**{'as':'geometry'})
def text(s,x,y,size=20,color='#334155',bold=False):
    f=ImageFont.truetype('C:/Windows/Fonts/'+('tahomabd.ttf' if bold else 'tahoma.ttf'),size)
    d.text((x,y),s,font=f,fill=color)
    svg.append(f'<text x="{x}" y="{y+size}" font-family="Tahoma,sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{html.escape(s)}</text>')
    cell(s,x,y,d.textlength(s,font=f)+10,size+14,f'text;html=0;align=left;verticalAlign=top;spacing=0;fontFamily=Tahoma;fontSize={size};fontColor={color};fontStyle={int(bold)};')
def rect(x,y,w,h,color='#ffffff',stroke='#cbd5e1'):
    d.rounded_rectangle((x,y,x+w,y+h),16,fill=color,outline=stroke,width=2)
    svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="{color}" stroke="{stroke}" stroke-width="2"/>')
    cell('',x,y,w,h,f'rounded=1;fillColor={color};strokeColor={stroke};strokeWidth=2;')
def table(name,title,x,y,w,fields,color):
    for field in fields: assert field in tables[name]['columns'],(name,field)
    rect(x,y,w,93+len(fields)*33,stroke=color)
    text(name,x+18,y+14,25,color,True); text(title,x+18,y+50,17)
    fks={c for fk in tables[name]['foreignKeys'].values() for c in fk['columnsFrom']}
    for i,field in enumerate(fields):
        c=tables[name]['columns'][field]
        prefix='PK  ' if c['primaryKey'] else 'FK  ' if field in fks else '      '
        text(prefix+field,x+18,y+87+i*33,19)
def arrow(points,label='',pos=None,color='#64748b',dashed=False):
    for a,b in zip(points,points[1:]):
        if not dashed: d.line([a,b],fill=color,width=3)
        else:
            length=math.dist(a,b)
            for k in range(0,int(length),16):
                d.line([tuple(a[j]+(b[j]-a[j])*v/length for j in (0,1)) for v in (k,min(k+9,length))],fill=color,width=3)
    a,b=points[-2:]; angle=math.atan2(b[1]-a[1],b[0]-a[0]); tip=[b]+[(b[0]-14*math.cos(angle+s),b[1]-14*math.sin(angle+s)) for s in (-.45,.45)]
    d.polygon(tip,fill=color)
    svg.append('<polyline points="'+' '.join(f'{x},{y}' for x,y in points)+f'" fill="none" stroke="{color}" stroke-width="3"'+(' stroke-dasharray="9 7"' if dashed else '')+'/><polygon points="'+' '.join(f'{x},{y}' for x,y in tip)+f'" fill="{color}"/>')
    global n
    n+=1; c=E.SubElement(root,'mxCell',id=str(n),edge='1',parent='1',style=f'endArrow=block;strokeColor={color};strokeWidth=2;dashed={int(dashed)};')
    g=E.SubElement(c,'mxGeometry',relative='1',**{'as':'geometry'})
    E.SubElement(g,'mxPoint',x=str(points[0][0]),y=str(points[0][1]),**{'as':'sourcePoint'})
    E.SubElement(g,'mxPoint',x=str(points[-1][0]),y=str(points[-1][1]),**{'as':'targetPoint'})
    arr=E.SubElement(g,'Array',**{'as':'points'})
    for x,y in points[1:-1]: E.SubElement(arr,'mxPoint',x=str(x),y=str(y))
    if label: text(label,*pos,17,color)

text('AGENCYAS V3 / DATABASE',55,30,21,'#0284c7',True)
text('แผนผังฐานข้อมูลและความสัมพันธ์หลัก',55,72,40,'#0f172a',True)
text('PostgreSQL 17  •  แสดงฟิลด์สำคัญ  •  ลูกศรชี้จากตารางลูกไปตารางที่ถูกอ้างอิง (FK → PK)',55,137,22)
text('เส้นทึบ: Foreign Key   |   เส้นประสีทอง: อ้างอิงด้วยโค้ด ไม่มี Foreign Key   |   ฉบับละเอียด: 37 ตาราง / 64 FK',55,179,20,'#64748b')

table('provinces','ข้อมูลจังหวัด',55,270,350,['id','name_th','slug','code','hero_image_id'],'#2563eb')
table('document_types','ประเภทเอกสาร',55,580,350,['id','code','name_th','group'],'#2563eb')
table('topics','หมวดประเด็น',55,870,350,['id','name_th','slug','color'],'#2563eb')
table('documents','เอกสารการดำเนินงาน',650,270,420,['id','province_id','type_id','topic_id','title','fiscal_year','_status','deleted_at'],'#0f766e')
table('dashboards','สารสนเทศเพื่อการตัดสินใจ',650,760,420,['id','province_id','topic_id','thumbnail_id','title','embed_url','pinned','_status'],'#0f766e')
table('documents_rels','ตารางเชื่อมไฟล์เอกสาร',1170,310,340,['id','parent_id','path','files_id'],'#7c3aed')
table('dashboards_rels','ตารางเชื่อมไฟล์ประกอบ',1170,810,340,['id','parent_id','path','files_id'],'#7c3aed')
table('files','ไฟล์และเวอร์ชันของไฟล์',1700,350,430,['id','filename','public_path','mime_type','version_no','is_current','version_of_id','uploaded_by_id'],'#c2410c')
table('users','บัญชีเจ้าหน้าที่',1700,870,430,['id','username','role','status'],'#6d28d9')

arrow([(650,390),(405,390)],'province_id',(450,355))
arrow([(650,450),(515,450),(515,665),(405,665)],'type_id',(530,555))
arrow([(650,510),(570,510),(570,950),(405,950)],'topic_id',(425,915))
arrow([(650,875),(465,875),(465,490),(405,490)],'province_id',(470,740))
arrow([(650,940),(600,940),(600,1040),(405,1040)],'topic_id',(470,1050))
arrow([(1170,390),(1070,390)],'parent_id',(1083,353))
arrow([(1510,465),(1700,465)],'files_id',(1560,429))
arrow([(1170,895),(1070,895)],'parent_id',(1083,858))
arrow([(1510,975),(1600,975),(1600,610),(1700,610)],'files_id',(1610,690))
arrow([(1070,1070),(1550,1070),(1550,680),(1700,680)],'thumbnail_id',(1195,1080))
arrow([(1915,707),(1915,870)],'uploaded_by_id',(1935,772))
arrow([(2130,570),(2170,570),(2170,405),(2130,405)],'version_of_id → files.id',(1770,302))

text('ความสัมพันธ์อื่นและตารางประกอบ',55,1190,28,'#0f172a',True)
for x,w,title,lines,color in [
    (55,650,'สิทธิ์และการเข้าสู่ระบบ',[
        'users ↔ provinces : ผ่าน users_rels (หลายต่อหลาย)',
        'user_tokens → users : เจ้าของโทเคน / ผู้สร้าง',
        'users_sessions / users_recovery_codes → users',
        'session_activity.user_id → users.id : ไม่มี FK'], '#6d28d9'),
    (755,650,'เนื้อหากลางและการตั้งค่า',[
        'central_contents ↔ files : central_contents_rels',
        'central_contents_links → central_contents / files',
        'announcements ↔ provinces : announcements_rels',
        'announcements.image_id / provinces.hero_image_id → files',
        'site_settings_footer_links → site_settings'], '#0f766e'),
    (1455,675,'สถิติและประวัติ',[
        'page_views → provinces : ยอดรายวัน / หน้า',
        'activity_logs → users / provinces : ประวัติใช้งาน',
        'cookie_consents : บันทึกความยินยอมแบบไม่ระบุตัวตน',
        'ตาราง _*_v : ประวัติเอกสาร / แดชบอร์ด / ประกาศ',
        'ตาราง payload_* : ข้อมูลภายใน CMS'], '#c2410c')]:
    rect(x,1245,w,265,stroke=color); text(title,x+18,1260,24,color,True)
    for i,line in enumerate(lines): text(line,x+18,1310+i*36,17)
rect(55,1540,2075,100,'#fffbeb','#fbbf24')
text('hit_counts',75,1558,24,'#92400e',True)
text('UNIQUE (kind, ref_id)  •  hits = ยอดรวม',75,1598,18)
arrow([(580,1590),(850,1590)],color='#d97706',dashed=True)
text('files.id : file_view / file_download     |     documents.id : doc_link     |     dashboards.id : dashboard_view',880,1575,18,'#92400e')
text('หมายเหตุ: ไฟล์เดียวแนบได้หลายรายการผ่าน *_rels • FK บางช่องอนุญาต NULL เพื่อรองรับร่าง • ไม่แสดงทุกเส้นในภาพรวม',55,1674,19)
text('อ้างอิง migration 20261014_143408_idle_sessions และ collections • ยังไม่ได้เทียบฐานข้อมูลที่กำลังรันจริง',55,1712,18,'#64748b')

img.save(OUT/'agencyasv3-database.png')
svg.append('</svg>'); (OUT/'agencyasv3-database.svg').write_text('\n'.join(svg),encoding='utf-8')
E.indent(mx,space='  '); E.ElementTree(mx).write(OUT/'agencyasv3-database.drawio',encoding='utf-8',xml_declaration=True)
for ext in ('svg','drawio'): E.parse(OUT/f'agencyasv3-database.{ext}')
print('Created database PNG, SVG, draw.io; selected fields verified against migration; XML valid.')
