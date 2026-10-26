# คู่มือติดตั้งระบบบนเซิร์ฟเวอร์จริง

ชุดติดตั้งอยู่ในโฟลเดอร์ `deploy/` ใช้ Docker Compose รันแอป (Next.js + Payload) กับฐานข้อมูล PostgreSQL 17 และให้ nginx รับหน้า

> **สิ่งที่ทดสอบแล้วบนเครื่องพัฒนา (12 ต.ค. 2569):** build อิมเมจ, เริ่มระบบบนฐานข้อมูลเปล่า (ระบบสร้างตารางเองจาก migration),
> สร้างผู้ดูแลระบบคนแรกและออกลิงก์เปิดใช้บัญชี, ย้ายเนื้อหาจากฐานข้อมูลพัฒนาเข้าไป แล้วเปิดหน้าจังหวัดและไฟล์ได้
> **สิ่งที่ยังไม่ได้ทดสอบ:** การติดตั้งบนเซิร์ฟเวอร์จริง, nginx และใบรับรอง HTTPS, การคัดลอกไฟล์ทั้ง 4.2 GB, การสลับโดเมน

> **คำเตือนเรื่องข้อมูล (อ่านก่อนเริ่ม)**
> - **ห้ามใช้ `docker compose down -v`** ตัว `-v` ลบ volume `dbdata` (ฐานข้อมูลทั้งหมด) และ `storage` (ไฟล์เอกสารทั้งหมด) ทิ้งถาวร จะหยุดระบบให้ใช้ `docker compose down` เฉยๆ
> - ห้ามใช้ `docker volume rm`, `docker volume prune` หรือ `docker system prune --volumes` บนเซิร์ฟเวอร์นี้ ด้วยเหตุผลเดียวกัน
> - **สำรองฐานข้อมูลก่อนอัปเดตทุกครั้ง** (ข้อ 8)
> - **หลังขึ้นระบบ ห้ามย้ายฐานข้อมูลจากเครื่องพัฒนามาทับ** (ข้อ 4 ทำครั้งเดียวตอนติดตั้ง) ข้อมูลที่จังหวัดลงไว้บนระบบจริงจะหายทั้งหมด
> - ฐานข้อมูลและไฟล์เอกสารไม่อยู่ใน git `git pull` ไม่ได้สำรองหรือกู้คืนข้อมูลให้

## สิ่งที่ต้องมี

> ขั้นตอนแบบเช็กลิสต์: เตรียมเครื่องตาม [SERVER_PREP.md](SERVER_PREP.md) แล้วติดตั้งตาม [SERVER_INSTALL.md](SERVER_INSTALL.md) ไฟล์นี้อธิบายรายละเอียดและเหตุผลของแต่ละขั้น

- เซิร์ฟเวอร์ Linux ที่ติดตั้ง Docker และ Docker Compose แล้ว และมี nginx
- พื้นที่ดิสก์อย่างน้อย 15 GB (ไฟล์เอกสารเดิม 4.2 GB + ฐานข้อมูล + อิมเมจ + ที่ว่างสำหรับไฟล์ใหม่)
- โฟลเดอร์ `web/` และ `deploy/` ของโปรเจกต์ (ไม่ต้องเอา `web/node_modules`, `web/.next`, `web/storage`) ดึงจาก GitHub หรือคัดลอกไปเองก็ได้ ดูข้อ 9

## 1. ตั้งค่า

```bash
cd deploy
cp .env.example .env
```

แก้ `.env`:

| ตัวแปร | ค่า |
|---|---|
| `DB_PASSWORD` | รหัสผ่านฐานข้อมูล สุ่มยาวๆ (ตัวอักษรและตัวเลข) |
| `PAYLOAD_SECRET` | ค่าลับของระบบ สุ่มยาวอย่างน้อย 32 ตัวอักษร |
| `SITE_URL` | ที่อยู่เว็บจริง ไม่มี / ต่อท้าย: `https://agencyas.gdcatalog.go.th` |
| `FIRST_ADMIN_USERNAME` | ชื่อผู้ใช้ของผู้ดูแลระบบส่วนกลางคนแรก (ใช้เฉพาะการเริ่มระบบครั้งแรก) |
| `FIRST_ADMIN_NAME` | ชื่อ นามสกุล ของผู้ดูแลคนแรก |
| `WEB_PORT` | พอร์ตในเครื่องที่แอปเปิด (ค่าเริ่มต้น 3000) |

**ข้อสำคัญเกี่ยวกับ `PAYLOAD_SECRET`:** เก็บสำรองไว้ในที่ปลอดภัย ถ้าค่านี้เปลี่ยนหรือหาย ทุกคนจะหลุดจากระบบ
และรหัสลับ 2FA ที่เก็บไว้จะอ่านไม่ได้ ผู้ใช้ทุกคนต้องให้ผู้ดูแลรีเซ็ต 2FA แล้วตั้งค่าใหม่

## 2. เริ่มระบบ

```bash
docker compose up -d --build
```

ครั้งแรกระบบจะสร้างตารางในฐานข้อมูลเอง (migration) และสร้างบัญชีผู้ดูแลคนแรก

## 3. เปิดใช้บัญชีผู้ดูแลคนแรก

```bash
docker compose logs web | grep "First admin"
```

จะเห็นลิงก์เปิดใช้บัญชี (ใช้ได้ครั้งเดียว อายุ 14 วัน) เปิดลิงก์นั้นเพื่อตั้งรหัสผ่านและตั้งค่า 2FA
จากนั้นลบค่า `FIRST_ADMIN_USERNAME` และ `FIRST_ADMIN_NAME` ออกจาก `.env`

ลิงก์นี้อยู่ใน log ของเซิร์ฟเวอร์ ใครอ่าน log ได้ก็ใช้ลิงก์ได้ จึงควรเปิดใช้ทันทีหลังเริ่มระบบ

## 4. ย้ายเนื้อหาจากเครื่องพัฒนา

เนื้อหา 76 จังหวัดที่นำเข้าและตรวจแล้วอยู่ในฐานข้อมูลของเครื่องพัฒนา ย้ายได้สองส่วน:

**4.1 ข้อมูลในฐานข้อมูล** (ไม่รวมบัญชีผู้ใช้ สถิติการเข้าชม ยอดเข้าชม/ดาวน์โหลดรายเอกสาร ประวัติการใช้งาน และบันทึกคุกกี้)

บนเครื่องพัฒนา:

```bash
mkdir -p deploy-export && { docker exec agencyasv3-db-1 pg_dump -U agencyas -d agencyas --data-only --disable-triggers -T 'payload_migrations' -T 'users*' -T 'user_tokens*' -T 'payload_preferences*' -T 'payload_locked_documents*' -T 'cookie_consents' -T 'page_views' -T 'hit_counts' -T 'activity_logs' -T 'account_requests*' -T 'session_activity' -T 'payload_kv'; echo 'UPDATE public.files SET uploaded_by_id = NULL WHERE uploaded_by_id IS NOT NULL;'; } > deploy-export/content.sql
```

ไม่รวมคำขอบัญชีและ session ของเครื่องพัฒนา และล้างช่องผู้อัปโหลดของไฟล์ (บัญชีผู้ใช้ไม่ได้ย้าย)

คัดลอก `deploy-export/content.sql` ไปเซิร์ฟเวอร์ แล้วรันในโฟลเดอร์ `deploy`:

```bash
docker compose exec -T db psql -U agencyas -d agencyas -v ON_ERROR_STOP=1 < content.sql
```

ต้องทำกับฐานข้อมูลที่ยังไม่มีเนื้อหา (หลังขั้นที่ 2 ทันที) ถ้ารันซ้ำจะชนกับข้อมูลที่มีอยู่

**ทำครั้งเดียวตอนติดตั้งเท่านั้น** หลังเปิดให้จังหวัดใช้งาน ฐานข้อมูลบนเซิร์ฟเวอร์เป็นชุดหลัก ส่วนของเครื่องพัฒนาเป็นชุดทดสอบ
ห้ามนำ `content.sql` หรือฐานข้อมูลจากเครื่องพัฒนามาทับอีก

**4.2 ไฟล์เอกสาร** (โฟลเดอร์ `web/storage/` ประมาณ 4.2 GB)

คัดลอกโฟลเดอร์ `web/storage` ไปเซิร์ฟเวอร์ แล้ว:

```bash
docker compose cp ./storage/. web:/app/storage/
docker compose exec -u 0 web chown -R nextjs:nodejs /app/storage
```

**4.3 ตรวจ**

- เปิด `https://<โดเมน>/sisaket`, `/sisaket/docs`, `/sisaket/utilization`, `/sisaket/guides`
- เปิดไฟล์ตัวอย่าง `https://<โดเมน>/uploads/content/smprakan/file01_20220527040401.pdf`
- จำนวนที่ควรได้ (ไฟล์ส่งออก 19 ต.ค. 2569): 76 จังหวัด, 2,966 เอกสาร, 558 แดชบอร์ด, 3,498 ไฟล์, 20 หัวข้อเนื้อหากลาง

ทางเลือก: ถ้าไม่ย้ายจากเครื่องพัฒนา ให้นำเข้าจากต้นทางใหม่ด้วย `web/scripts/import.ts` ซึ่งต้องมีโฟลเดอร์ `migration/` (รวม `files/`) และ Node.js บนเครื่องที่รัน

## 5. nginx และ HTTPS

**ความปลอดภัย (ตรวจ 17 ต.ค. 2569):**
- `SITE_URL` ต้องตรงกับที่อยู่ที่ผู้ใช้เปิดจริงทุกตัวอักษร (`https://agencyas.gdcatalog.go.th` ไม่มี / ท้าย) ระบบรับคุกกี้เข้าสู่ระบบเฉพาะคำขอจากที่อยู่นี้ ถ้าไม่ตรง จะเข้าหลังบ้านไม่ได้ และคุกกี้จะส่งเฉพาะ HTTPS เมื่อที่อยู่ขึ้นต้นด้วย https://
- ใช้ `deploy/nginx.conf`: มี HSTS (เปิดเมื่อใบรับรองใช้งานได้แล้ว) ซ่อนเวอร์ชัน nginx และจำกัดคำขอเข้าสู่ระบบ 10 ครั้งต่อนาทีต่อ IP (`limit_req_zone` ต้องอยู่ในบล็อก `http`; ถ้าไฟล์ site ถูก include ภายใน `http` อยู่แล้ว วางตามตัวอย่างได้เลย)
- `PAYLOAD_SECRET` สุ่มยาวอย่างน้อย 32 ตัวอักษร เช่น `openssl rand -hex 32`
- ก่อนขึ้นระบบ: อัปเดตแพ็กเกจตาม `npm audit` แล้วรันชุดทดสอบทั้ง 4 ชุด

ใช้ `deploy/nginx.conf` เป็นตัวอย่าง แก้ `server_name` และใส่ใบรับรอง จุดสำคัญ:

- `client_max_body_size 50m` สำหรับการอัปโหลดเอกสาร
- ส่ง header `Host`, `X-Forwarded-For`, `X-Forwarded-Proto` ต่อไปยังแอป

## 6. สลับจากเว็บเดิม

**โดเมน (ปรับ 26 ต.ค. 2569):** เว็บใหม่ใช้โดเมนเดิม `https://agencyas.gdcatalog.go.th` และรองรับ path เดิมทั้งหมด (`/{จังหวัด}`, `/docs`, `/utilization`, `/uploads/content/...`) ลิงก์เดิมที่จังหวัดเคยแชร์จึงใช้ได้ต่อ
ช่วงเปลี่ยนผ่าน (ตั้งแต่ 19 ต.ค. 2569) ระบบเปิดที่ที่อยู่ชั่วคราว `https://newagencyas.gdcatalog.go.th` เมื่อย้ายมาโดเมนเดิมแล้ว ที่อยู่ชั่วคราวส่งต่อ (301) มาที่ agencyas โดยคง path ไว้ (บล็อกท้าย `deploy/nginx.conf`) บุ๊กมาร์กและลิงก์เปิดใช้บัญชีที่ออกช่วงนั้นจึงยังใช้ได้

### 6.1 ย้ายจาก newagencyas กลับมาที่ agencyas (เซิร์ฟเวอร์ที่ติดตั้งไว้แล้ว)

ข้อมูล บัญชี รหัสผ่าน 2FA และสถิติใช้ต่อได้ทั้งหมด (ผูกกับฐานข้อมูล ไม่ผูกกับโดเมน) ผู้ใช้แค่เข้าสู่ระบบใหม่ 1 ครั้ง ผู้เข้าชมที่เคยตอบแถบคุกกี้จะเห็นแถบอีกครั้ง

**ก่อนวันสลับ**
- [ ] ขอผู้ดูแล DNS ลด TTL ของ `agencyas.gdcatalog.go.th` ล่วงหน้า 1–2 วัน (ตอนนี้ชี้เครื่องเว็บเดิม)
- [ ] เตรียมใบรับรอง HTTPS ของ `agencyas.gdcatalog.go.th` (หรือขอ Let's Encrypt หลัง DNS ชี้มาแล้ว) และให้ใบรับรองของ `newagencyas` ยังไม่หมดอายุ (ใช้กับการส่งต่อ)
- [ ] สำรองเว็บเดิมไว้ หลังสลับ DNS จะเข้าเครื่องเดิมทางโดเมนไม่ได้แล้ว

**วันสลับ** (บนเซิร์ฟเวอร์ใหม่ ในโฟลเดอร์ `/opt/agencyas/deploy`)
1. ขอผู้ดูแล DNS ชี้ `agencyas.gdcatalog.go.th` มาที่เครื่องนี้ แล้วตรวจว่าได้ IP ของเครื่องนี้: `getent hosts agencyas.gdcatalog.go.th`
2. สำรองฐานข้อมูล (`before-update-…dump` ตามข้อ 8)
3. `git pull` เพื่อให้ได้ `deploy/nginx.conf` รุ่นที่ใช้ agencyas
4. nginx: แทนไฟล์ site เดิมด้วยไฟล์ใหม่ แล้วใส่ path ใบรับรองทั้ง 2 บล็อก 443 (agencyas และบล็อกส่งต่อ newagencyas)
   ```bash
   sudo cp /opt/agencyas/deploy/nginx.conf /etc/nginx/sites-available/newagencyas && sudo nano /etc/nginx/sites-available/newagencyas
   ```
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```
   ไฟล์ site ชื่อ `newagencyas` ตามที่ติดตั้งไว้ จะเปลี่ยนชื่อไฟล์หรือไม่ก็ได้ ถ้าไม่มีใบรับรองของ newagencyas แล้ว ให้ใส่ `#` หน้าบล็อกส่งต่อท้ายไฟล์ ไม่อย่างนั้น `nginx -t` ไม่ผ่าน
5. แก้ `deploy/.env` เป็น `SITE_URL=https://agencyas.gdcatalog.go.th` แล้วสั่ง `docker compose up -d` (ไม่ต้อง `--build`)
6. หลังบ้าน → ตั้งค่าเว็บไซต์ → นโยบายความเป็นส่วนตัว: แก้ `https://newagencyas.gdcatalog.go.th` ในข้อความเป็น agencyas แล้วตรวจว่าไม่มีคำว่า newagencyas เหลือในเนื้อหา (ต้องได้ 0)
   ```bash
   docker compose exec -T db pg_dump -U agencyas -d agencyas --data-only | grep -c "newagencyas"
   ```
7. Google Analytics (ถ้าตั้งแล้ว): แก้ URL ของ Data stream เป็น agencyas (Measurement ID เดิมใช้ต่อได้)

**ตรวจหลังสลับ**
- [ ] `https://agencyas.gdcatalog.go.th/sisaket` เปิดได้ มีรูปกุญแจ
- [ ] `https://newagencyas.gdcatalog.go.th/sisaket/docs` พาไป `https://agencyas.gdcatalog.go.th/sisaket/docs`
- [ ] เข้าหลังบ้านที่ agencyas ได้ (ถ้าเข้าไม่ได้ ตรวจ `SITE_URL` ก่อน)
- [ ] ลิงก์ไฟล์เดิม `/uploads/content/...` เปิดได้
- [ ] แจ้งจังหวัดว่าย้ายเสร็จแล้ว ใช้บัญชีเดิมเข้าสู่ระบบที่ agencyas ได้ทันที

### 6.2 เปิดใช้งานแทนเว็บเดิม

1. แจ้งจังหวัดหยุดลงข้อมูลในเว็บเดิม
2. ถ้ามีข้อมูลใหม่ในเว็บเดิมหลังวันที่ดึงข้อมูล (11 ต.ค. 2569) ต้องดึงและนำเข้าเพิ่มก่อน
3. ชี้โดเมน agencyas.gdcatalog.go.th มาที่เซิร์ฟเวอร์ใหม่ (ข้อ 6.1)
4. ตรวจลิงก์เดิม: `/{slug}`, `/{slug}/docs`, `/{slug}/utilization`, `/uploads/content/...` ต้องเปิดได้เหมือนเดิม
5. นำเข้าผู้ดูแลจังหวัด 76 คนจากไฟล์ Excel แล้วส่งลิงก์เปิดใช้บัญชีให้แต่ละคน

## 7. การสำรองข้อมูล

ต้องสำรองสองอย่างคู่กันเสมอ: ฐานข้อมูล และไฟล์เอกสาร

**สำรองอัตโนมัติทุกวัน** ใช้สคริปต์ `deploy/backup.sh` (ยังไม่ได้ทดสอบบนเซิร์ฟเวอร์จริง) ตั้งใน cron ของเซิร์ฟเวอร์:

```
15 2 * * *  /opt/agencyas/deploy/backup.sh >> /var/log/agencyas-backup.log 2>&1
```

- เก็บไว้ที่ `/var/backups/agencyas` ย้อนหลัง 14 วัน (เปลี่ยนได้ด้วยตัวแปร `BACKUP_DIR` และ `KEEP_DAYS`)
- ควรคัดลอกโฟลเดอร์สำรองไปเก็บอีกเครื่องหนึ่งด้วย สำรองไว้บนดิสก์เดียวกับระบบไม่ช่วยเมื่อดิสก์เสีย
- เก็บสำเนา `.env` (โดยเฉพาะ `PAYLOAD_SECRET`) แยกไว้ในที่ปลอดภัย

**กู้คืน** (ทำกับระบบที่หยุดรับงานแล้ว):

```bash
docker compose exec -T db pg_restore -U agencyas -d agencyas --clean --if-exists < db-YYYY-MM-DD.dump
docker compose exec -T web tar xzf - -C /app/storage < storage-YYYY-MM-DD.tgz
```

## 7.1 งานที่ระบบทำเองตามเวลา

ไม่ต้องตั้ง cron เพิ่ม ระบบทำเองหลังเริ่มทำงาน 1 นาที และทุก 6 ชั่วโมง:

- ระงับบัญชีที่ไม่ได้เข้าสู่ระบบเกิน 365 วัน (ไม่รวมผู้ดูแลระบบส่วนกลาง)
- ลบถาวรเอกสารและแดชบอร์ดที่อยู่ในถังขยะเกิน 30 วัน

ทั้งสองอย่างถูกบันทึกในเมนู "ประวัติการใช้งาน"

## 8. การอัปเดตระบบ

**1) สำรองฐานข้อมูลก่อนทุกครั้ง** (ถ้า migration ใหม่มีปัญหาจะได้ย้อนกลับได้) ในโฟลเดอร์ `deploy`:

```bash
mkdir -p /var/backups/agencyas
docker compose exec -T db pg_dump -U agencyas -d agencyas -Fc > /var/backups/agencyas/before-update-$(date +%F-%H%M).dump
```

ตรวจว่าไฟล์ไม่ว่าง (`ls -lh /var/backups/agencyas`) ก่อนทำต่อ ไฟล์นี้ไม่ถูกลบอัตโนมัติ ลบเองเมื่ออัปเดตผ่านไปแล้วสักระยะ
ไฟล์เอกสารไม่ต้องสำรองซ้ำตอนอัปเดต (การอัปเดตไม่แตะ `storage`) ใช้ชุดสำรองรายวันจากข้อ 7

**2) อัปเดตและเริ่มใหม่**

```bash
cd deploy
docker compose up -d --build
```

volume `dbdata` และ `storage` ยังอยู่ครบหลังสร้างอิมเมจใหม่ อย่าใส่ `-v` และอย่าลบ volume (ดูคำเตือนต้นเอกสาร)

**3) ตรวจหลังอัปเดต:** `docker compose logs web --tail 50` ต้องไม่มี error เรื่อง migration แล้วเปิดหน้าจังหวัดและหลังบ้านดู
ถ้า migration ล้ม ให้กู้ฐานข้อมูลจากไฟล์ `before-update-…dump` ด้วยคำสั่ง `pg_restore` ในข้อ 7 แล้วกลับไปใช้โค้ดรุ่นก่อน (`git checkout <commit ก่อนหน้า>`)

ถ้าโครงสร้างข้อมูลเปลี่ยน ต้องสร้าง migration ใหม่จากเครื่องพัฒนาก่อน (`npx payload migrate:create <ชื่อ>` ในโฟลเดอร์ `web`)
แล้วนำไฟล์ใน `web/src/migrations/` ขึ้นไปด้วย ระบบจะรัน migration ที่ยังไม่ได้รันเองตอนเริ่ม

## 9. Git

โค้ดอยู่ใน git ตั้งแต่ 15 ต.ค. 2569 ที่โฟลเดอร์หลักของโปรเจกต์ (branch `main`) และเก็บบน GitHub แบบ **private**
ผ่าน GitHub Desktop ไฟล์ที่ไม่เข้า git กำหนดไว้ใน `.gitignore` ที่ระดับบนสุด ได้แก่ `web/.env`, `deploy/.env`, `web/storage/`,
`migration/files/`, `image76/`, `docs/manual/`, `crawl/raw/`, `web/node_modules/`, `web/.next/`
(รายละเอียดและที่เก็บของแต่ละรายการอยู่ใน `README.md`)

**ห้ามนำ `.env` เข้า git** ค่าใน `deploy/.env` ของเซิร์ฟเวอร์ (โดยเฉพาะ `PAYLOAD_SECRET`) เก็บสำรองแยกในที่ปลอดภัย

### นำโค้ดขึ้นเซิร์ฟเวอร์ด้วย git (ทางเลือก)

repository เป็น private เซิร์ฟเวอร์จึงต้องมีสิทธิ์อ่าน วิธีที่แนะนำคือ deploy key แบบอ่านอย่างเดียว:

1. บนเซิร์ฟเวอร์สร้างกุญแจ: `ssh-keygen -t ed25519 -f ~/.ssh/agencyas_deploy -N ""`
2. ใน GitHub เปิด repository → Settings → Deploy keys → Add deploy key วางเนื้อหาไฟล์ `~/.ssh/agencyas_deploy.pub` **ไม่ติ๊ก** Allow write access
3. ดึงโค้ด (แทน `<owner>/<repo>` ด้วยชื่อจริง):

```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/agencyas_deploy" git clone git@github.com:<owner>/<repo>.git /opt/agencyas
```

อัปเดตครั้งต่อไป (แทนการคัดลอกโฟลเดอร์ในข้อ 8):

```bash
cd /opt/agencyas
GIT_SSH_COMMAND="ssh -i ~/.ssh/agencyas_deploy" git pull
cd deploy
docker compose up -d --build
```

`deploy/.env` และ `web/storage` ไม่อยู่ใน git จึงไม่ถูกแตะตอน `git pull` ไฟล์เอกสารยังต้องคัดลอกแยกตามข้อ 4.2 ครั้งแรกครั้งเดียว
ถ้าไม่สะดวกตั้ง deploy key ให้คัดลอกโฟลเดอร์ `web/` และ `deploy/` ขึ้นไปเองเหมือนเดิม

ขั้นตอนนี้ยังไม่ได้ทดสอบบนเซิร์ฟเวอร์จริง
