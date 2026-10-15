"""Create matching editable draw.io, SVG and PNG architecture artifacts."""
from pathlib import Path
import math
import html
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
W, H = 1800, 1330
im = Image.new('RGB', (W, H), '#f8fafc')
draw = ImageDraw.Draw(im)
font_path = 'C:/Windows/Fonts/tahoma.ttf'
bold_path = 'C:/Windows/Fonts/tahomabd.ttf'
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><rect width="100%" height="100%" fill="#f8fafc"/>']
mx = ET.Element('mxfile', host='app.diagrams.net', type='device')
page = ET.SubElement(mx, 'diagram', name='System architecture', id='architecture')
model = ET.SubElement(page, 'mxGraphModel', grid='1', page='1', pageWidth=str(W), pageHeight=str(H), pageScale='1')
root = ET.SubElement(model, 'root')
ET.SubElement(root, 'mxCell', id='0')
ET.SubElement(root, 'mxCell', id='1', parent='0')
seq = 1

def cell(value, x,y,w,h,style):
    global seq
    seq += 1
    c = ET.SubElement(root,'mxCell',id=str(seq),value=value,style=style,vertex='1',parent='1')
    ET.SubElement(c,'mxGeometry',x=str(x),y=str(y),width=str(w),height=str(h),**{'as':'geometry'})

def box(x,y,w,h,fill='#ffffff',stroke='#cbd5e1',radius=18):
    draw.rounded_rectangle((x,y,x+w,y+h),radius,fill=fill,outline=stroke,width=2)
    svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
    cell('',x,y,w,h,f'rounded=1;arcSize=10;fillColor={fill};strokeColor={stroke};strokeWidth=2;')

def text(s,x,y,size=20,color='#334155',bold=False):
    font=ImageFont.truetype(bold_path if bold else font_path,size)
    draw.text((x,y),s,font=font,fill=color)
    svg.append(f'<text x="{x}" y="{y+size}" font-family="Tahoma, sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{html.escape(s)}</text>')
    width=draw.textlength(s,font=font)+8
    cell(s,x,y,width,size+14,f'text;html=0;align=left;verticalAlign=top;spacing=0;fontFamily=Tahoma;fontSize={size};fontColor={color};fontStyle={1 if bold else 0};')

def arrow(points, color='#64748b', dashed=False):
    for a,b in zip(points,points[1:]):
        if dashed:
            length=math.dist(a,b)
            for d in range(0,int(length),14):
                p=tuple(a[i]+(b[i]-a[i])*d/length for i in (0,1))
                q=tuple(a[i]+(b[i]-a[i])*min(d+8,length)/length for i in (0,1))
                draw.line([p,q],fill=color,width=3)
        else: draw.line([a,b],fill=color,width=3)
    a,b=points[-2:]; angle=math.atan2(b[1]-a[1],b[0]-a[0])
    tip=[b,(b[0]-13*math.cos(angle-.45),b[1]-13*math.sin(angle-.45)),(b[0]-13*math.cos(angle+.45),b[1]-13*math.sin(angle+.45))]
    draw.polygon(tip,fill=color)
    coords=' '.join(f'{x},{y}' for x,y in points)
    dash='stroke-dasharray="8 6"' if dashed else ''
    svg.append(f'<polyline points="{coords}" fill="none" stroke="{color}" stroke-width="3" {dash}/><polygon points="'+ ' '.join(f'{x},{y}' for x,y in tip)+f'" fill="{color}"/>')
    global seq
    seq+=1
    c=ET.SubElement(root,'mxCell',id=str(seq),edge='1',parent='1',style=f'endArrow=block;endFill=1;strokeColor={color};strokeWidth=2;dashed={int(dashed)};rounded=0;')
    g=ET.SubElement(c,'mxGeometry',relative='1',**{'as':'geometry'})
    ET.SubElement(g,'mxPoint',x=str(points[0][0]),y=str(points[0][1]),**{'as':'sourcePoint'})
    ET.SubElement(g,'mxPoint',x=str(points[-1][0]),y=str(points[-1][1]),**{'as':'targetPoint'})
    if len(points)>2:
        arr=ET.SubElement(g,'Array',**{'as':'points'})
        for x,y in points[1:-1]: ET.SubElement(arr,'mxPoint',x=str(x),y=str(y))

text('AGENCYAS V3',50,35,20,'#0284c7',True)
text('สถาปัตยกรรมระบบบัญชีข้อมูลจังหวัด',50,72,38,'#0f172a',True)
text('76 จังหวัด  •  Next.js + Payload CMS ในแอปเดียว  •  PostgreSQL + Persistent storage',50,130,21)

box(370,200,1380,700,'#eff6ff','#bfdbfe',24)
text('เซิร์ฟเวอร์ Linux — รูปแบบ production ตามชุด deploy',400,220,24,'#1e40af',True)
text('nginx บน host   |   Docker Compose: web + db   |   ยังไม่ได้ยืนยันการติดตั้งจริง',400,260,18)
box(50,320,270,225)
text('ผู้ใช้งาน / Browser',70,342,23,'#0f172a',True)
text('ประชาชน: เว็บจังหวัด',70,390,19)
text('เจ้าหน้าที่จังหวัด',70,427,19)
text('ผู้ดูแลระบบส่วนกลาง',70,464,19)
text('เจ้าหน้าที่ใช้รหัสผ่าน + 2FA',70,505,16,'#64748b')

box(410,365,250,200,'#ffffff','#93c5fd')
text('nginx',432,390,29,'#1e40af',True)
text('HTTPS / TLS :443',432,440,20)
text('HTTP :80 → HTTPS',432,477,18)
text('Reverse proxy',432,516,18)

box(730,315,530,510,'#ffffff','#60a5fa')
text('web container',755,337,19,'#0284c7',True)
text('Next.js 16 + Payload CMS 3',755,372,27,'#0f172a',True)
text('Node.js 22 • React 19 • port 3000',755,416,18)
box(755,465,480,93,'#eff6ff','#dbeafe',10)
text('หน้าเว็บสาธารณะ',773,477,21,'#1e40af',True)
text('/{province} • docs • utilization • guides',773,516,17)
box(755,575,480,92,'#f5f3ff','#ede9fe',10)
text('หลังบ้าน /admin และระบบบัญชีผู้ใช้',773,587,21,'#6d28d9',True)
text('สิทธิ์ส่วนกลาง / จังหวัด • 2FA • จัดการเนื้อหา',773,626,17)
text('API + server logic + Payload Local API',755,693,20,'#0f172a',True)
text('อัปโหลด / ดาวน์โหลด • สถิติ • Audit log',755,733,18)
text('Migration ตอนเริ่มระบบ • งานบำรุงรักษาตามเวลา',755,772,17)

box(1360,345,340,185,'#ffffff','#5eead4')
text('PostgreSQL 17',1383,366,27,'#0f766e',True)
text('db container • internal :5432',1383,414,18)
text('เนื้อหา / ผู้ใช้ / สถิติ / ประวัติ',1383,451,18)
text('Persistent volume: dbdata',1383,493,17,'#64748b')
box(1360,620,340,158,'#ffffff','#5eead4')
text('ไฟล์อัปโหลด',1383,640,26,'#0f766e',True)
text('PDF / Excel / ภาพ',1383,685,19)
text('volume: storage → /app/storage',1383,728,17)
text('ฐานข้อมูลไม่เปิดพอร์ตออกสู่ภายนอก',1360,810,17,'#0f766e')

arrow([(320,430),(410,430)])
text('HTTPS',328,399,15)
arrow([(660,465),(730,465)])
text('localhost',650,573,14)
text(':3000',668,594,14)
arrow([(1260,435),(1360,435)])
text('SQL',1282,403,16)
arrow([(1260,699),(1360,699)])
text('File I/O',1275,668,16)

box(50,650,270,210,'#ffffff','#c4b5fd')
text('บริการภายนอก',70,669,23,'#6d28d9',True)
text('CKAN จังหวัด',70,713,20)
text('เปิดลิงก์ค้นหาชุดข้อมูล',70,746,16)
text('Power BI / ArcGIS / Looker',70,786,17)
text('ฝังผ่าน browser เมื่ออนุญาต',70,820,16)
arrow([(185,545),(185,650)],'#8b5cf6')
text('ลิงก์ / Embed',198,586,15,'#6d28d9')

text('การนำขึ้นระบบและการสำรองข้อมูล',50,940,27,'#0f172a',True)
text('เส้นประ = ขั้นตอนที่เสนอให้ใช้ / ต้องตั้งค่าเพิ่มเติม',50,982,18,'#64748b')
for x,w,heading,lines in [
    (50,280,'เครื่องพัฒนา',['แก้โค้ด / ทดสอบ','สร้าง database migration']),
    (405,280,'Private Git repository',['โค้ด + lockfile + migrations','ไม่เก็บ .env หรือข้อมูลจริง']),
    (760,420,'Deploy รุ่นที่ผ่านการตรวจ',['ดึงโค้ด → Docker build → Compose up','ตั้งค่า .env บน server แยกต่างหาก']),
    (1360,340,'สำรองและกู้คืน',['backup.sh: DB dump + ไฟล์','ตั้ง cron และสำเนานอกเครื่อง'])]:
    box(x,1040,w,155,'#ffffff','#cbd5e1')
    text(heading,x+18,1058,21,'#0f172a',True)
    for j,line in enumerate(lines): text(line,x+18,1104+j*36,16)
arrow([(330,1115),(405,1115)],'#0284c7',True)
arrow([(685,1115),(760,1115)],'#0284c7',True)
arrow([(970,1040),(970,900)],'#0284c7',True)
arrow([(1530,900),(1530,1040)],'#0f766e',True)
text('แหล่งอ้างอิง: deploy/docker-compose.yml • nginx.conf • backup.sh • web/Dockerfile • src/payload.config.ts',50,1240,17)
text('แผนภาพจากโค้ดและชุดติดตั้ง ณ 15 ต.ค. 2569 — Git workflow เป็นข้อเสนอ ไม่ใช่ CI/CD ที่ติดตั้งแล้ว',50,1276,17,'#64748b')

im.save(OUT/'agencyasv3-architecture.png')
svg.append('</svg>')
(OUT/'agencyasv3-architecture.svg').write_text('\n'.join(svg),encoding='utf-8')
ET.indent(mx,space='  ')
ET.ElementTree(mx).write(OUT/'agencyasv3-architecture.drawio',encoding='utf-8',xml_declaration=True)
ET.parse(OUT/'agencyasv3-architecture.drawio')
ET.parse(OUT/'agencyasv3-architecture.svg')
print('Created PNG, SVG and editable draw.io architecture; XML validated.')
