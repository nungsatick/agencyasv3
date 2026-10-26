# ติดตั้งระบบบนเซิร์ฟเวอร์ หลังดึงโค้ดจาก git

ทำต่อจาก [SERVER_PREP.md](SERVER_PREP.md) (เตรียมเครื่องเสร็จแล้ว deploy key เชื่อม GitHub ได้)
รายละเอียดเพิ่มเติมและเหตุผลของแต่ละขั้นอยู่ใน [DEPLOY.md](DEPLOY.md)

- โดเมน: **`https://agencyas.gdcatalog.go.th`** (เซิร์ฟเวอร์ที่ติดตั้งไว้ที่ newagencyas แล้ว ให้ย้ายตาม DEPLOY.md ข้อ 6.1)
- โฟลเดอร์ติดตั้ง: `/opt/agencyas`
- คำสั่ง `docker compose …` ทุกคำสั่ง รันในโฟลเดอร์ `/opt/agencyas/deploy`

ปรับปรุงล่าสุด: 20 ตุลาคม 2569

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
  - ไฟล์ทั้งหมดใน `web/storage/` (3,498 ไฟล์ ประมาณ 4.26 GB) คัดลอกด้วย FileZilla (SFTP) ตามข้อ 5
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
cat > .env <<'EOF'
DB_PASSWORD=
PAYLOAD_SECRET=
SITE_URL=https://agencyas.gdcatalog.go.th
FIRST_ADMIN_USERNAME=
FIRST_ADMIN_NAME=
WEB_PORT=3000
EOF
chmod 600 .env
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
| `SITE_URL` | `https://agencyas.gdcatalog.go.th` — **ตรงทุกตัวอักษร ไม่มี / ท้าย** ไม่อย่างนั้นเข้าหลังบ้านไม่ได้ |
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

ต้องย้าย 2 อย่างคู่กัน ถ้าย้ายอย่างเดียว หน้าเว็บจะมีรายการเอกสารแต่เปิดไฟล์ไม่ได้ หรือมีไฟล์แต่ไม่มีรายการ

| สิ่งที่ย้าย | บนเครื่องพัฒนา | วางบนเซิร์ฟเวอร์ | ตรวจ |
|---|---|---|---|
| ข้อมูล (ข้อความ รายการเอกสาร รายการไฟล์) | `deploy-export\content.sql` | `/opt/agencyas/content.sql` | 5,131,264 ไบต์ |
| ไฟล์เอกสารจริง (PDF รูป Excel) | ไฟล์ทั้งหมด**ข้างใน** `web\storage\` | `/opt/agencyas/storage-import/` | 3,498 ไฟล์, 4,582,157,798 ไบต์ (ประมาณ 4.26 GB) |

ตัวเลขในคอลัมน์ "ตรวจ" เป็นของไฟล์ส่งออกวันที่ 19 ต.ค. 2569 ถ้าส่งออกใหม่ ให้นับใหม่บนเครื่องพัฒนาด้วยคำสั่งในข้อ 5.2

`web/storage` มีแต่ไฟล์อยู่ชั้นเดียว ไม่มีโฟลเดอร์ย่อย ทั้งสองอย่างไม่อยู่ใน git จึงต้องคัดลอกขึ้นเซิร์ฟเวอร์เอง

**5.1 คัดลอกไฟล์ด้วย FileZilla (SFTP)**

1. File → Site Manager → New site
   - Protocol: **SFTP - SSH File Transfer Protocol** (ไม่ใช้ FTP ธรรมดา เพราะเซิร์ฟเวอร์ไม่มี FTP server และ FTP ส่งรหัสผ่านแบบไม่เข้ารหัส)
   - Host: IP ของเซิร์ฟเวอร์, Port: `22`
   - บัญชี: บัญชีเดียวกับที่ SSH เข้าเซิร์ฟเวอร์ (รหัสผ่าน หรือ Key file)
2. ฝั่งขวา (Remote site) พิมพ์ `/opt/agencyas` ในช่อง path แล้วกด Enter (FileZilla เปิดที่ `/home/ชื่อบัญชี` เป็นค่าเริ่มต้น)
   - คลิกขวา → **Create directory** → ตั้งชื่อ `storage-import`
3. ลาก `content.sql` จาก `deploy-export\` ฝั่งซ้าย ไปวางที่ `/opt/agencyas` (ไม่ใช่ใน `storage-import` หรือ `deploy`)
4. ฝั่งซ้ายเข้าไปใน `web\storage\` เลือกทุกไฟล์ (Ctrl+A) ลากไปวางใน `/opt/agencyas/storage-import`
   - ลากเฉพาะไฟล์ข้างใน ไม่ใช่ตัวโฟลเดอร์ `storage`
5. ระหว่างส่ง อย่าปิด FileZilla และอย่าให้เครื่องพัฒนา sleep (ใช้เวลานาน เพราะไฟล์มีหลายพันไฟล์)
   - ถ้าหลุดกลางทาง: เชื่อมต่อใหม่ แล้วลากชุดเดิมไปอีกครั้ง เลือก **Overwrite if size differs** ไฟล์ที่ครบแล้วจะถูกข้าม
6. เมื่อคิวว่าง ดูแท็บ **Failed transfers** ต้องว่าง (ถ้ามี: คลิกขวา → Reset and requeue)

ถ้าสร้างโฟลเดอร์หรือวางไฟล์ไม่ได้ (Permission denied / Directory not found) แสดงว่ายังไม่ได้ทำ SERVER_PREP ข้อ 8 ให้รันบนเซิร์ฟเวอร์ด้วยบัญชีเดียวกับที่ใช้ใน FileZilla:

```bash
sudo mkdir -p /opt/agencyas && sudo chown $USER /opt/agencyas
```

> ทางเลือกแทน FileZilla: `scp` จาก Git Bash บนเครื่องพัฒนา (แทน `user@server` ด้วยบัญชีจริง)
> `scp deploy-export/content.sql user@server:/opt/agencyas/` และ `scp -r web/storage user@server:/opt/agencyas/storage-import`
> (`scp -r` แบบนี้จะได้ไฟล์อยู่ตรงใน `storage-import` เลย)

**5.2 ตรวจว่าไฟล์มาครบ** (บนเซิร์ฟเวอร์)

ไฟล์ต้องอยู่ตรงใน `storage-import` ต้องเห็นชื่อไฟล์ เช่น `ACR.jpg`, `article_NO.1.pdf` ไม่ใช่โฟลเดอร์ `storage`

```bash
ls /opt/agencyas/storage-import | head
```

> ถ้าเห็นแค่ `storage` แปลว่าลากทั้งโฟลเดอร์ไป ให้ใช้ `../storage-import/storage/.` แทน `../storage-import/.` ในข้อ 5.5 และในคำสั่งตรวจด้านล่าง

จำนวนไฟล์ต้องได้ **3498** และขนาดรวมประมาณ **4582157798** (เกินได้ไม่กี่ KB เพราะรวมขนาดของตัวโฟลเดอร์)

```bash
find /opt/agencyas/storage-import -maxdepth 1 -type f | wc -l && du -sb /opt/agencyas/storage-import
```

ขนาด `content.sql` ต้องได้ **5131264**

```bash
ls -l /opt/agencyas/content.sql
```

นับบนเครื่องพัฒนาเพื่อเทียบ (Git Bash ที่โฟลเดอร์ `agencyasv3`)

```bash
find web/storage -type f | wc -l && du -sb web/storage && ls -l deploy-export/content.sql
```

**5.3 ตรวจก่อนนำเข้า** (ในโฟลเดอร์ `deploy`)

ระบบต้องทำงานอยู่: `db` เป็น healthy, `web` เป็น Up

```bash
docker compose ps
```

ฐานข้อมูลต้องยัง**ไม่มีเนื้อหา** ต้องได้ `0` ถ้าไม่ใช่ 0 ให้หยุด อย่านำเข้า (จะชนกับข้อมูลที่มีอยู่)

```bash
docker compose exec -T db psql -U agencyas -d agencyas -At -c "select count(*) from documents"
```

> เปิดใช้บัญชีผู้ดูแลคนแรก (ข้อ 4) ก่อนได้ ไม่ชนกัน เพราะ `content.sql` ไม่มีบัญชีผู้ใช้
> แต่ห้ามเพิ่มเอกสาร แดชบอร์ด หรือเนื้อหาใดๆ ในหลังบ้านก่อนนำเข้า

**5.4 นำเข้าเนื้อหาในฐานข้อมูล** (ทำครั้งเดียว ถ้ารันซ้ำจะชนกับข้อมูลเดิม)

```bash
docker compose exec -T db psql -U agencyas -d agencyas -v ON_ERROR_STOP=1 < ../content.sql
```

ถ้าขึ้น ERROR ให้หยุดและเก็บข้อความไว้ อย่ารันซ้ำ

**5.5 คัดลอกไฟล์เอกสารเข้าระบบ** (ใช้เวลาหลายนาที)

```bash
docker compose cp ../storage-import/. web:/app/storage/
```

ให้แอปมีสิทธิ์อ่านไฟล์

```bash
docker compose exec -u 0 web chown -R nextjs:nodejs /app/storage
```

**5.6 ตรวจผล**

ไฟล์ในระบบต้องได้ **3498**

```bash
docker compose exec web sh -c "find /app/storage -type f | wc -l && du -sh /app/storage"
```

จำนวนในฐานข้อมูล (ไฟล์ส่งออกวันที่ 19 ต.ค. 2569 ได้ 76 / 2966 / 558 / 20 ถ้าส่งออกใหม่ ตัวเลขอาจต่างตามข้อมูลบนเครื่องพัฒนา)

```bash
docker compose exec -T db psql -U agencyas -d agencyas -c "select (select count(*) from provinces) provinces, (select count(*) from documents where deleted_at is null) documents, (select count(*) from dashboards where deleted_at is null) dashboards, (select count(*) from central_contents) central"
```

เปิดในเบราว์เซอร์ (หลังตั้ง nginx ข้อ 6) เช่น `https://agencyas.gdcatalog.go.th/sisaket/docs`
- กดเปิด PDF สักไฟล์ ต้องเปิดได้
- ภาพเด่นจังหวัดและภาพหน้าแดชบอร์ดต้องขึ้น

**5.7 ลบไฟล์ชั่วคราว** (เมื่อตรวจผ่านแล้ว และยังมีสำเนาบนเครื่องพัฒนา)

```bash
rm -rf /opt/agencyas/storage-import /opt/agencyas/content.sql
```

ไฟล์เอกสารอยู่ใน Docker volume `storage` แล้ว อยู่ครบหลัง restart และ `git pull` (ยกเว้นสั่ง `docker compose down -v` ซึ่งห้ามทำ)

- [ ] ไฟล์ครบ 3498 ทั้งใน `storage-import` และใน container
- [ ] นำเข้า `content.sql` ไม่มี ERROR และจำนวนตรง
- [ ] เปิด PDF และภาพได้จากหน้าเว็บ
- [ ] ลบไฟล์ชั่วคราวแล้ว

### 6. nginx และ HTTPS

คัดลอกไฟล์ตั้งค่า

```bash
sudo cp /opt/agencyas/deploy/nginx.conf /etc/nginx/sites-available/agencyas
```

```bash
sudo ln -s /etc/nginx/sites-available/agencyas /etc/nginx/sites-enabled/ && sudo rm -f /etc/nginx/sites-enabled/default
```

แก้ไฟล์: เปิดบรรทัด `ssl_certificate` และ `ssl_certificate_key` แล้วใส่ path ของใบรับรอง (เอาเครื่องหมาย `#` ออก)

```bash
sudo nano /etc/nginx/sites-available/agencyas
```

ตรวจไฟล์และโหลดใหม่ (ต้องขึ้น `syntax is ok` และ `test is successful`)

```bash
sudo nginx -t && sudo systemctl reload nginx
```

- [ ] เปิด `https://agencyas.gdcatalog.go.th/sisaket` จากเครื่องอื่นได้ และมีรูปกุญแจ
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
- [ ] แจ้งจังหวัดว่าเว็บใหม่เปิดที่ `https://agencyas.gdcatalog.go.th` (โดเมนเดิม ลิงก์เดิมใช้ได้ต่อ)
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
