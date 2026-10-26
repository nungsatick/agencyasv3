# เตรียมเครื่องเซิร์ฟเวอร์ ก่อนดึงโค้ดจาก git

ขั้นตอนนี้ทำครั้งเดียวบนเครื่องเซิร์ฟเวอร์ใหม่ ก่อนเริ่มติดตั้งตาม [DEPLOY.md](DEPLOY.md)
คำสั่งด้านล่างใช้กับ **Ubuntu 22.04 / 24.04** ถ้าเป็นระบบอื่นต้องปรับคำสั่ง

- โดเมนของเว็บใหม่: **`https://newagencyas.gdcatalog.go.th`**
- Repository: `nungsatick/agencyasv3` บน GitHub (private)

ปรับปรุงล่าสุด: 19 ตุลาคม 2569

---

## 1. ตรวจสเปกเครื่อง

- ดิสก์ว่างอย่างน้อย **15 GB** (ไฟล์เอกสาร 4.3 GB + ฐานข้อมูล + อิมเมจ + ไฟล์สำรอง)
- RAM แนะนำ **4 GB ขึ้นไป** (ตอนสร้างอิมเมจใช้หน่วยความจำมาก)

```bash
df -h / && free -h
```

## 2. อัปเดตระบบ

```bash
sudo apt update && sudo apt upgrade -y
```

## 3. ตั้งเวลาเครื่องให้ตรง (สำคัญ)

รหัส 2FA 6 หลักอิงเวลา ถ้าเวลาเครื่องคลาดเกิน 30 วินาที **จะไม่มีใครเข้าระบบได้**

```bash
sudo timedatectl set-timezone Asia/Bangkok && sudo timedatectl set-ntp true
```

ตรวจว่าขึ้น `System clock synchronized: yes`

```bash
timedatectl
```

## 4. ติดตั้ง Docker และ Docker Compose

```bash
curl -fsSL https://get.docker.com | sudo sh
```

ตรวจว่าติดตั้งครบ (ต้องเห็นเลขเวอร์ชันทั้งสองบรรทัด)

```bash
sudo docker --version && sudo docker compose version
```

ให้บัญชีที่ใช้ติดตั้งสั่ง docker ได้โดยไม่ต้องใช้ sudo (ออกจากระบบแล้วเข้าใหม่ 1 ครั้งจึงมีผล)

```bash
sudo usermod -aG docker $USER
```

## 5. ติดตั้ง nginx และ git

```bash
sudo apt install -y nginx git
```

## 6. เปิด firewall เฉพาะพอร์ตที่ใช้

เปิดเฉพาะ SSH, HTTP (80) และ HTTPS (443) ส่วนแอป (3000) และฐานข้อมูลผูกไว้กับเครื่องตัวเองอยู่แล้ว คนนอกเข้าไม่ได้

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

ตรวจสถานะ

```bash
sudo ufw status
```

## 7. โดเมนและใบรับรอง HTTPS

- [ ] ตั้ง DNS ของ `newagencyas.gdcatalog.go.th` ให้ชี้มาที่ IP ของเครื่องนี้ (ขอผู้ดูแล DNS ของ gdcatalog.go.th)
- [ ] ใบรับรอง HTTPS ของ `newagencyas.gdcatalog.go.th`
  - ถ้าหน่วยงานออกใบรับรองให้: เตรียมไฟล์ `.crt` (รวม chain) และ `.key` ไว้ใส่ใน nginx ภายหลัง
  - ถ้าใช้ Let's Encrypt: ทำได้หลัง DNS ชี้มาเครื่องนี้แล้ว

ตรวจว่า DNS ชี้มาถูกเครื่อง (ต้องได้ IP ของเครื่องนี้)

```bash
getent hosts newagencyas.gdcatalog.go.th
```

## 8. สร้างโฟลเดอร์ติดตั้ง

```bash
sudo mkdir -p /opt/agencyas && sudo chown $USER /opt/agencyas
```

## 9. ตั้ง deploy key ให้เซิร์ฟเวอร์อ่าน repository ได้

Repository เป็น private เซิร์ฟเวอร์จึงต้องมีกุญแจของตัวเอง (อ่านได้อย่างเดียว)

สร้างกุญแจ

```bash
ssh-keygen -t ed25519 -f ~/.ssh/agencyas_deploy -N ""
```

แสดงกุญแจสาธารณะเพื่อคัดลอก

```bash
cat ~/.ssh/agencyas_deploy.pub
```

จากนั้น **เจ้าของ repository** ทำบน GitHub:

1. เปิด `nungsatick/agencyasv3` → **Settings** → **Deploy keys** → **Add deploy key**
2. วางกุญแจที่คัดลอกมา ตั้งชื่อ เช่น `server newagencyas`
3. **ไม่ติ๊ก** Allow write access
4. กด **Add key**

ทดสอบการเชื่อมต่อ (ต้องเห็นข้อความ "successfully authenticated")

```bash
ssh -i ~/.ssh/agencyas_deploy -T git@github.com
```

---

## สรุปก่อนไปขั้นถัดไป

- [ ] ดิสก์ว่าง ≥ 15 GB, RAM ≥ 4 GB
- [ ] ระบบอัปเดตแล้ว
- [ ] เวลาเครื่องตรง (`System clock synchronized: yes`)
- [ ] Docker และ Docker Compose ใช้งานได้ (สั่ง `docker ps` ได้โดยไม่ต้องใช้ sudo)
- [ ] nginx และ git ติดตั้งแล้ว
- [ ] firewall เปิดเฉพาะ 22, 80, 443
- [ ] DNS `newagencyas.gdcatalog.go.th` ชี้มาเครื่องนี้ และมีใบรับรอง HTTPS (หรือพร้อมขอ Let's Encrypt)
- [ ] มีโฟลเดอร์ `/opt/agencyas`
- [ ] deploy key เชื่อม GitHub ได้

ครบแล้ว ขั้นต่อไปคือดึงโค้ดและติดตั้งตาม [SERVER_INSTALL.md](SERVER_INSTALL.md)
(ใน `deploy/.env` ตั้ง `SITE_URL=https://newagencyas.gdcatalog.go.th` ตรงทุกตัวอักษร ไม่มี / ท้าย)
