import React from 'react'

/** Shown on "new file": what can be uploaded and what happens next, in place of the technical fields. */
export function UploadHelp() {
  return (
    <div className="agy__note agy-upload-help">
      <strong>เพิ่มไฟล์ใหม่</strong>
      <ul>
        <li>กด &quot;เลือกไฟล์&quot; หรือลากไฟล์มาวางในกรอบด้านบน แล้วกด &quot;บันทึก&quot;</li>
        <li>รับไฟล์ PDF, รูปภาพ (JPG, PNG, GIF, WebP) และ Excel ขนาดไม่เกิน 50 MB</li>
        <li>ชื่อไฟล์ที่ผู้เข้าชมเห็นมาจากชื่อไฟล์ในเครื่อง ตั้งชื่อให้สื่อความหมายก่อนอัปโหลด (แก้ภายหลังได้)</li>
        <li>ลิงก์ของไฟล์ ประวัติเวอร์ชัน และค่าตรวจสอบ ระบบสร้างให้เอง</li>
      </ul>
    </div>
  )
}
