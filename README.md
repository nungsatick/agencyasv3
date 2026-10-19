# ระบบสนับสนุนการจัดทำบัญชีข้อมูลจังหวัด

เว็บไซต์ใหม่ที่ https://newagencyas.gdcatalog.go.th แทนที่เว็บเดิม agencyas.gdcatalog.go.th (PHP) รองรับ path เดิมทั้งหมด (โดเมนเดิมส่งต่อมาได้)

- **หน้าเว็บสาธารณะ** ของ 76 จังหวัด ได้แก่ หน้าจังหวัด (`/{slug}`), เอกสาร (`/{slug}/docs`) และแดชบอร์ด (`/{slug}/utilization`)
- **ระบบหลังบ้าน** (`/admin`) สำหรับส่วนกลางและเจ้าหน้าที่จังหวัด เพื่อจัดการเอกสาร แดชบอร์ด เนื้อหากลาง ผู้ใช้ ประกาศ และสถิติ
- เข้าสู่ระบบด้วยชื่อผู้ใช้ รหัสผ่าน และรหัส 2FA จากแอป ระบบไม่ส่งอีเมลเอง (ไม่มี mail server)

รายละเอียดทั้งหมดอยู่ใน [docs/SYSTEM_SUMMARY.md](docs/SYSTEM_SUMMARY.md)

## เทคโนโลยี

Next.js 16 (App Router) + Payload CMS 3 + PostgreSQL 17 เป็นแอปเดียวในโฟลเดอร์ `web/` ติดตั้งบนเซิร์ฟเวอร์ด้วย Docker Compose หลัง nginx

## โครงสร้างโฟลเดอร์

| โฟลเดอร์ | เนื้อหา |
|---|---|
| `web/` | แอปหลัก (หน้าเว็บ + หลังบ้าน) |
| `web/src/collections/` | โครงสร้างข้อมูลและสิทธิ์ของแต่ละตาราง |
| `web/src/app/(frontend)/` | หน้าเว็บสาธารณะ หน้าเข้าสู่ระบบ และหน้าขอใช้บัญชี |
| `web/src/components/admin/` | หน้าจอหลังบ้านที่สร้างเพิ่ม |
| `web/src/migrations/` | migration ฐานข้อมูล ต้องรันตอนติดตั้งระบบจริง |
| `web/scripts/` | สคริปต์นำเข้าข้อมูล โหลดข้อมูลตั้งต้น และชุดทดสอบ |
| `deploy/` | ชุดติดตั้งบนเซิร์ฟเวอร์ (Docker Compose, nginx, สคริปต์สำรองข้อมูล) |
| `migration/` | ข้อมูลจากเว็บเดิมที่จับคู่เข้าโครงสร้างใหม่ (`import/*.json`), `manifest.json` (sha256 ของไฟล์เดิม) และสคริปต์สร้างข้อมูล |
| `crawl/` | ผลสำรวจเว็บเดิม (`sites.json`) |
| `76province_hero/` | ภาพเด่นส่วนหัว 76 จังหวัด (`{CODE}.jpg`) |
| `assets/logos/` | โลโก้หน่วยงาน (ต้นฉบับ) |
| `docs/` | เอกสารระบบ คู่มือติดตั้ง แผนภาพ ร่างนโยบาย และบันทึกการเปลี่ยนแปลง |

## สิ่งที่ไม่อยู่ใน git

ดูทั้งหมดได้ใน [.gitignore](.gitignore)

| รายการ | เหตุผล / เก็บไว้ที่ไหน |
|---|---|
| `web/.env`, `deploy/.env` | มีรหัสลับ ดูตัวอย่างได้จาก `.env.example` ในโฟลเดอร์เดียวกัน |
| `web/storage/` (ประมาณ 4.3 GB) | ไฟล์ที่เว็บใช้จริง หลังขึ้นระบบชุดหลักอยู่บนเซิร์ฟเวอร์ และสำรองด้วย `deploy/backup.sh` |
| `migration/files/` (ประมาณ 4.2 GB) | ไฟล์ต้นฉบับจากเว็บเดิม เก็บสำเนาไว้นอก git ตรวจความครบถ้วนได้ด้วย `migration/manifest.json` |
| `image76/` | ภาพต้นฉบับของ `76province_hero/` |
| `docs/manual/` | คู่มือผู้ใช้ที่ทำแยก |
| `docs/design/` | ภาพหน้าจอและหน้าตัวอย่างตอนออกแบบหน้าเข้าสู่ระบบ |
| `assets/hero-old/`, `assets/login/` | ภาพเด่นชุดเก่า และภาพหน้าเข้าสู่ระบบที่ไม่ได้ใช้ (เก็บไว้ในเครื่อง) |
| `76province_logo/` | สำเนาตราจังหวัด ชุดที่ใช้จริงอยู่ที่ `web/public/logos/` |
| `.claude/`, `web/.vscode/` | ค่าตั้งของโปรแกรมบนเครื่องผู้พัฒนา |
| `crawl/raw/` | หน้าเว็บเดิมที่บันทึกไว้ |
| `web/node_modules/`, `web/.next/` | สร้างใหม่ได้ด้วย `npm install` และ `npm run build` |

## เปิดระบบบนเครื่องพัฒนา

ต้องมี Node.js และ Docker Desktop

```bash
docker compose up -d db
```

```bash
npm --prefix web install
```

```bash
npm --prefix web run dev
```

จากนั้นเปิด http://localhost:3000/sisaket (หน้าเว็บ) หรือ http://localhost:3000/admin (หลังบ้าน)

- ฐานข้อมูลพัฒนาอยู่ที่พอร์ต 5433 รหัสผ่านใน `docker-compose.yml` ใช้บนเครื่องพัฒนาเท่านั้น
- เครื่องใหม่ที่ฐานข้อมูลยังว่าง: สร้าง `web/.env` จาก `web/.env.example` แล้วนำเข้าข้อมูลเดิมด้วย `npx payload run scripts/import.ts` ในโฟลเดอร์ `web` (ต้องมี `migration/files/`) ขั้นตอนต่อจากนั้นอยู่ใน SYSTEM_SUMMARY ข้อ 4
- ถ้าเปลี่ยนโครงสร้างข้อมูล ให้สร้าง migration ด้วย `npx payload migrate:create <ชื่อ>` แล้วตามด้วย `npx payload generate:types`

## ทดสอบ

รันในโฟลเดอร์ `web` ขณะที่เซิร์ฟเวอร์พัฒนาเปิดอยู่ ทุกชุดสร้างข้อมูลทดสอบเองและลบออกเมื่อจบ

```bash
npx payload run scripts/check-auth.ts
```

ชุดอื่นคือ `check-public.ts`, `check-extras.ts` และ `check-versions.ts` รายละเอียดอยู่ใน SYSTEM_SUMMARY ข้อ 10

## ติดตั้งบนเซิร์ฟเวอร์

เตรียมเครื่องตาม [docs/SERVER_PREP.md](docs/SERVER_PREP.md) ติดตั้งตาม [docs/SERVER_INSTALL.md](docs/SERVER_INSTALL.md) รายละเอียดอยู่ใน [docs/DEPLOY.md](docs/DEPLOY.md) ได้แก่ ตั้งค่า `deploy/.env`, สร้างอิมเมจ, ย้ายฐานข้อมูลและ `web/storage`, ตั้ง nginx และตั้งการสำรองข้อมูลรายวัน

## เอกสารอื่น

- [docs/CHANGELOG.md](docs/CHANGELOG.md): บันทึกการเปลี่ยนแปลงรายวัน และ migration ที่ต้องรัน
- [docs/policy/](docs/policy/): ร่างนโยบายความเป็นส่วนตัวและนโยบายคุกกี้
- `docs/*.drawio`, `*.png`, `*.svg`: แผนภาพสถาปัตยกรรมและฐานข้อมูล
