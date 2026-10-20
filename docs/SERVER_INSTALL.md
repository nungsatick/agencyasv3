# ติดตั้งระบบบนเซิร์ฟเวอร์ หลังดึงโค้ดจาก git

ทำต่อจาก [SERVER_PREP.md](SERVER_PREP.md) (เตรียมเครื่องเสร็จแล้ว deploy key เชื่อม GitHub ได้)
รายละเอียดเพิ่มเติมและเหตุผลของแต่ละขั้นอยู่ใน [DEPLOY.md](DEPLOY.md)

- โดเมน: **`https://newagencyas.gdcatalog.go.th`**
- โฟลเดอร์ติดตั้ง: `/opt/agencyas`
- คำสั่ง `docker compose …` ทุกคำสั่ง รันในโฟลเดอร์ `/opt/agencyas/deploy`

ปรับปรุงล่าสุด: 19 ตุลาคม 2569

> **ห้ามทำบนเซิร์ฟเวอร์นี้**
> - `docker compose down -v`, `docker volume rm`, `docker volume prune`, `docker system prune --volumes` — ลบฐานข้อมูลและไฟล์เอกสารทิ้งถาวร (จะหยุดระบบใช้ `docker compose down` เฉยๆ)
> - นำฐานข้อมูลจากเครื่องพัฒนามาทับ หลังจากเปิดให้จังหวัดใช้งานแล้ว

---

## ส่วนที่ 1 — เตรียมไว้บนเครื่องพัฒนา (ก่อนไปเซิร์ฟเวอร์)

- [ ] อัปเดตแพ็กเกจตามผลตรวจความปลอดภัย และรันชุดทดสอบทั้ง 4 ชุดผ่าน
- [ ] commit และ push งานล่าสุดขึ้น GitHub
- [ ] ส่งออกเนื้อหาจากฐานข้อมูลพัฒนาเป็น `content.sql` (รันที่โฟลเดอร์ `agencyasv3` บนเครื่องพัฒนา):

```bash
mkdir -p deploy-export && { docker exec agencyasv3-db-1 pg_dump -U agencyas -d agencyas --data-only --disable-triggers -T 'payload_migrations' -T 'users*' -T 'user_tokens*' -T 'payload_preferences*' -T 'payload_locked_documents*' -T 'cookie_consents' -T 'page_views' -T 'hit_counts' -T 'activity_logs' -T 'account_requests*' -T 'session_activity' -T 'payload_kv'; echo 'UPDATE public.files SET uploaded_by_id = NULL WHERE uploaded_by_id IS NOT NULL;'; } > deploy-export/content.sql
```

ไม่รวมบัญชีผู้ใช้ สถิติ ประวัติการใช้งาน บันทึกคุกกี้ คำขอบัญชี และ session (ข้อมูลทดสอบ ระบบจริงเริ่มนับใหม่) ช่อง "ผู้อัปโหลด" ของไฟล์ถูกล้าง เพราะบัญชีบนเครื่องพัฒนาไม่ได้ย้ายไป
ไฟล์อยู่ที่ `deploy-export/content.sql` (ไม่อยู่ใน git) ตรวจแล้ว 19 ต.ค. 2569 ว่านำเข้าฐานข้อมูลเปล่าได้ครบ ไม่มีการอ้างอิงที่ขาด

- [ ] เตรียมไฟล์ที่จะคัดลอกไปเซิร์ฟเวอร์:
  - `deploy-export/content.sql`
  - โฟลเดอร์ `web/storage/` (ประมาณ 4.3 GB)
  - `migration/import/province_managers_76.xlsx` (บัญชีผู้ดูแลจังหวัด 76 บัญชี)

---

## ส่วนที่ 2 — บนเซิร์ฟเวอร์

### 1. ดึงโค้ด

```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/agencyas_deploy" git clone git@github.com:nungsatick/agencyasv3.git /opt/agencyas
```

```bash
cd /opt/agencyas/deploy
```

### 2. ตั้งค่า `deploy/.env`

```bash
cp .env.example .env && chmod 600 .env
```

สร้างค่าลับสองค่า (คัดลอกผลลัพธ์ไปใส่ใน `.env`)

```bash
openssl rand -hex 24 && openssl rand -hex 32
```

แก้ไฟล์ `.env`

```bash
nano .env
```

| ตัวแปร | ใส่ค่า |
|---|---|
| `DB_PASSWORD` | ผลลัพธ์บรรทัดแรก (48 ตัว) |
| `PAYLOAD_SECRET` | ผลลัพธ์บรรทัดที่สอง (64 ตัว) |
| `SITE_URL` | `https://newagencyas.gdcatalog.go.th` — **ตรงทุกตัวอักษร ไม่มี / ท้าย** ไม่อย่างนั้นเข้าหลังบ้านไม่ได้ |
| `FIRST_ADMIN_USERNAME` | ชื่อผู้ใช้ผู้ดูแลส่วนกลางคนแรก (อังกฤษพิมพ์เล็ก 4–32 ตัว) |
| `FIRST_ADMIN_NAME` | ชื่อ นามสกุล ของผู้ดูแลคนแรก |
| `WEB_PORT` | เว้นไว้ (3000) |

- [ ] **คัดลอก `PAYLOAD_SECRET` และ `DB_PASSWORD` ไปเก็บสำรองในที่ปลอดภัย** ถ้า `PAYLOAD_SECRET` หาย ทุกคนต้องตั้ง 2FA ใหม่

### 3. เริ่มระบบ

ครั้งแรกใช้เวลาหลายนาที (สร้างอิมเมจ) ระบบสร้างตารางและรัน migration ทั้งหมดเอง

```bash
docker compose up -d --build
```

ตรวจว่าทั้งสองตัวทำงาน (`db` เป็น healthy, `web` เป็น Up)

```bash
docker compose ps
```

ดู log ถ้ามีปัญหา

```bash
docker compose logs web --tail 50
```

### 4. เปิดใช้บัญชีผู้ดูแลคนแรก (ทำทันที)

```bash
docker compose logs web | grep "First admin"
```

- [ ] เปิดลิงก์ที่ได้ (ใช้ได้ครั้งเดียว อายุ 14 วัน) ตั้งรหัสผ่าน ตั้ง 2FA ในแอปบนโทรศัพท์ และเก็บรหัสสำรอง
- [ ] ลบค่า `FIRST_ADMIN_USERNAME` และ `FIRST_ADMIN_NAME` ออกจาก `.env` (ลิงก์อยู่ใน log ใครอ่าน log ได้ก็ใช้ได้)

> ถ้ายังไม่ได้ตั้ง nginx (ข้อ 6) ลิงก์จะเปิดไม่ได้จากเครื่องอื่น ทำข้อ 6 ก่อนแล้วกลับมาเปิดลิงก์ได้ ลิงก์อายุ 14 วัน

### 5. ย้ายเนื้อหา (ทำครั้งเดียว ทันทีหลังข้อ 3)

คัดลอกไฟล์จากเครื่องพัฒนาไปเซิร์ฟเวอร์ เช่นด้วย WinSCP หรือ `scp` (จาก Git Bash บนเครื่องพัฒนา แทน `user@server` ด้วยบัญชีจริง)

```bash
scp deploy-export/content.sql user@server:/opt/agencyas/
```

```bash
scp -r web/storage user@server:/opt/agencyas/storage-import
```

**5.1 นำเข้าเนื้อหาในฐานข้อมูล** (บนเซิร์ฟเวอร์ ในโฟลเดอร์ `deploy`) ต้องทำกับฐานข้อมูลที่ยังว่าง ถ้ารันซ้ำจะชนกับข้อมูลเดิม

```bash
docker compose exec -T db psql -U agencyas -d agencyas -v ON_ERROR_STOP=1 < ../content.sql
```

**5.2 คัดลอกไฟล์เอกสารเข้าระบบ**

```bash
docker compose cp ../storage-import/. web:/app/storage/
```

```bash
docker compose exec -u 0 web chown -R nextjs:nodejs /app/storage
```

**5.3 ตรวจจำนวน** (ไฟล์ส่งออกวันที่ 19 ต.ค. 2569 ได้ 76 / 2966 / 558 / 20 ถ้าส่งออกใหม่ ตัวเลขอาจต่างตามข้อมูลบนเครื่องพัฒนา)

```bash
docker compose exec -T db psql -U agencyas -d agencyas -c "select (select count(*) from provinces) provinces, (select count(*) from documents where deleted_at is null) documents, (select count(*) from dashboards where deleted_at is null) dashboards, (select count(*) from central_contents) central"
```

- [ ] ตรวจแล้ว ลบไฟล์ชั่วคราว `../content.sql` และ `../storage-import` ได้ (เก็บสำเนาไว้นอกเครื่องแล้ว)

### 6. nginx และ HTTPS

คัดลอกไฟล์ตั้งค่า

```bash
sudo cp /opt/agencyas/deploy/nginx.conf /etc/nginx/sites-available/newagencyas
```

```bash
sudo ln -s /etc/nginx/sites-available/newagencyas /etc/nginx/sites-enabled/ && sudo rm -f /etc/nginx/sites-enabled/default
```

แก้ไฟล์: เปิดบรรทัด `ssl_certificate` และ `ssl_certificate_key` แล้วใส่ path ของใบรับรอง (เอาเครื่องหมาย `#` ออก)

```bash
sudo nano /etc/nginx/sites-available/newagencyas
```

ตรวจไฟล์และโหลดใหม่ (ต้องขึ้น `syntax is ok` และ `test is successful`)

```bash
sudo nginx -t && sudo systemctl reload nginx
```

- [ ] เปิด `https://newagencyas.gdcatalog.go.th/sisaket` จากเครื่องอื่นได้ และมีรูปกุญแจ
- [ ] ไฟล์ตั้งค่าส่ง HSTS อยู่แล้ว (บังคับ https 1 ปี) ใช้เมื่อใบรับรองใช้งานได้จริงเท่านั้น ถ้ายังทดสอบใบรับรองอยู่ ให้ใส่ `#` หน้าบรรทัด `Strict-Transport-Security` ก่อน

### 7. ตรวจหน้าเว็บและหลังบ้าน

- [ ] หน้าเว็บ: `/sisaket`, `/sisaket/docs`, `/sisaket/utilization`, `/sisaket/guides`
- [ ] ไฟล์ตามลิงก์เดิม: `/uploads/content/smprakan/file01_20220527040401.pdf`
- [ ] หลังบ้าน: `/admin` เข้าสู่ระบบด้วยบัญชีผู้ดูแลคนแรก (รหัสผ่าน + 2FA) แล้วเปิดภาพรวม 76 จังหวัดได้

### 8. ตั้งการสำรองข้อมูลอัตโนมัติ

```bash
sudo mkdir -p /var/backups/agencyas && sudo chown $USER /var/backups/agencyas && chmod +x /opt/agencyas/deploy/backup.sh
```

ลองรันครั้งแรกด้วยมือ (ต้องจบด้วย `backup ok`)

```bash
/opt/agencyas/deploy/backup.sh
```

ตั้งให้รันทุกคืน 02:15

```bash
(crontab -l 2>/dev/null; echo "15 2 * * * /opt/agencyas/deploy/backup.sh >> /var/log/agencyas-backup.log 2>&1") | crontab -
```

- [ ] ตั้งการคัดลอก `/var/backups/agencyas` ไป**อีกเครื่องหนึ่ง** (ไฟล์สำรองบนดิสก์เดียวกับระบบไม่ช่วยเมื่อดิสก์เสีย)
- [ ] **ทดลองกู้คืน 1 ครั้ง** บนเครื่องทดสอบ (วิธีอยู่ใน DEPLOY.md ข้อ 7) สคริปต์นี้ยังไม่เคยทดสอบบนเซิร์ฟเวอร์จริง

### 9. สร้างบัญชีผู้ดูแลจังหวัด 76 บัญชี

1. หลังบ้าน → **เพิ่มและนำเข้าผู้ใช้** → นำเข้าหลายคนจาก Excel → เลือก `province_managers_76.xlsx`
2. ตรวจตัวอย่าง (ต้องพร้อม 76/76) แล้วกดยืนยัน
3. ดาวน์โหลดไฟล์ลิงก์เปิดใช้บัญชี แล้วส่งให้แต่ละจังหวัด (ลิงก์อายุ 14 วัน ใช้ได้ครั้งเดียว)

### 10. เปิดใช้งาน

- [ ] แจ้งจังหวัดหยุดลงข้อมูลในเว็บเดิม ถ้ามีข้อมูลใหม่หลัง 11 ต.ค. 2569 ต้องนำเข้าเพิ่มก่อน
- [ ] แจ้งที่อยู่เว็บใหม่ `https://newagencyas.gdcatalog.go.th` ให้จังหวัด
- [ ] (ถ้าต้องการ) ให้โดเมนเดิม `agencyas.gdcatalog.go.th` ส่งต่อมาโดเมนใหม่โดยคง path ไว้ ลิงก์เดิมที่จังหวัดแชร์ไว้จะมาเว็บใหม่ (ตัวอย่างอยู่ท้าย `deploy/nginx.conf`)
- [ ] ใส่นโยบายความเป็นส่วนตัวและนโยบายคุกกี้ฉบับจริง (หลังบ้าน → ตั้งค่าเว็บไซต์)

---

## การอัปเดตครั้งต่อไป

ทุกครั้งที่มีโค้ดใหม่บน GitHub (ในโฟลเดอร์ `/opt/agencyas/deploy`)

1. **สำรองฐานข้อมูลก่อน**

```bash
docker compose exec -T db pg_dump -U agencyas -d agencyas -Fc > /var/backups/agencyas/before-update-$(date +%F-%H%M).dump
```

2. ดึงโค้ดและสร้างใหม่ (ระบบรัน migration ใหม่ให้เอง ข้อมูลเดิมอยู่ครบ)

```bash
cd /opt/agencyas && GIT_SSH_COMMAND="ssh -i ~/.ssh/agencyas_deploy" git pull && cd deploy && docker compose up -d --build
```

3. ดู log ว่าไม่มี error แล้วเปิดหน้าเว็บและหลังบ้านตรวจ

```bash
docker compose logs web --tail 50
```

ถ้ามีปัญหา: กู้ฐานข้อมูลจากไฟล์ `before-update-…dump` และกลับไปใช้โค้ดรุ่นก่อน (DEPLOY.md ข้อ 8)
