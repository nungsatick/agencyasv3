'use client'

import React, { useState } from 'react'

import { thaiDayTime } from '@/lib/thaiDate'

export type DraftFor = { url: string; expiresAt: string; username: string; email: string; name?: string }

/** The e-mail that hands a new account its activation link, written out for the approver to check and send. */
function writeDraft(l: DraftFor) {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const subject = 'ลิงก์เปิดใช้บัญชี ระบบสนับสนุนการจัดทำบัญชีข้อมูลจังหวัด'
  const body = [
    `เรียน ${l.name || 'ผู้ขอใช้บัญชี'}`,
    '',
    'คำขอใช้บัญชีเจ้าหน้าที่ในระบบสนับสนุนการจัดทำบัญชีข้อมูลจังหวัดของท่านได้รับการอนุมัติแล้ว',
    '',
    `ชื่อผู้ใช้: ${l.username}`,
    `ลิงก์เปิดใช้บัญชี: ${l.url}`,
    `(ใช้ได้ครั้งเดียว หมดอายุ ${thaiDayTime(l.expiresAt)})`,
    '',
    'ขั้นตอนเปิดใช้บัญชี',
    '1. เปิดลิงก์ด้านบน แล้วตั้งรหัสผ่านของท่านเอง (อย่างน้อย 8 ตัวอักษร)',
    '2. ติดตั้งแอปยืนยันตัวตนบนโทรศัพท์ เช่น Google Authenticator หรือ Microsoft Authenticator แล้วสแกน QR code ที่หน้าจอ',
    '3. เก็บรหัสสำรองที่ระบบแสดงไว้ในที่ปลอดภัย ใช้เมื่อไม่มีโทรศัพท์',
    `4. ครั้งต่อไปเข้าสู่ระบบที่ ${origin}/login`,
    '',
    'ลิงก์นี้ใช้ได้กับบัญชีของท่านเท่านั้น กรุณาอย่าส่งต่อให้ผู้อื่น หากลิงก์หมดอายุหรือเปิดไม่ได้ กรุณาตอบกลับอีเมลนี้',
    '',
    'ขอแสดงความนับถือ',
    'ผู้ดูแลระบบ',
  ].join('\n')
  return { subject, body }
}

/**
 * After a link is issued: the e-mail to send, shown and editable, with ways to send it from the approver's
 * own mailbox (Gmail, Outlook on the web, the computer's mail program) or to copy it. The system itself
 * sends no e-mail (there is no mail server).
 */
export function EmailDraft({ link }: { link: DraftFor }) {
  const first = writeDraft(link)
  const [subject, setSubject] = useState(first.subject)
  const [body, setBody] = useState(first.body)
  const [copied, setCopied] = useState('')
  const to = encodeURIComponent(link.email)
  const su = encodeURIComponent(subject)
  const bo = encodeURIComponent(body)
  const copy = async (what: 'all' | 'body') => {
    await navigator.clipboard.writeText(what === 'all' ? `ถึง: ${link.email}\nเรื่อง: ${subject}\n\n${body}` : body)
    setCopied(what)
    window.setTimeout(() => setCopied(''), 2000)
  }
  return (
    <div className="agy-mail">
      <strong>ร่างอีเมลถึง {link.email}</strong>
      <label className="agy__field">
        <span>เรื่อง</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label className="agy__field">
        <span>ข้อความ (แก้ไขได้ก่อนส่ง)</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={19} />
      </label>
      <div className="agy__actions">
        <a className="agy__btn agy__btn--primary" href={`https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${su}&body=${bo}`} target="_blank" rel="noopener noreferrer">
          เปิดใน Gmail
        </a>
        <a className="agy__btn" href={`https://outlook.office.com/mail/deeplink/compose?to=${to}&subject=${su}&body=${bo}`} target="_blank" rel="noopener noreferrer">
          เปิดใน Outlook
        </a>
        <a className="agy__btn" href={`mailto:${to}?subject=${su}&body=${bo}`}>
          โปรแกรมอีเมลในเครื่อง
        </a>
        <button type="button" className="agy__btn" onClick={() => void copy('all')}>
          {copied === 'all' ? '✓ คัดลอกแล้ว' : 'คัดลอกอีเมลทั้งหมด'}
        </button>
      </div>
      <small className="agy__sub">ใช้อีเมลอื่น เช่น อีเมลราชการ (mail.go.th): กด &quot;คัดลอกอีเมลทั้งหมด&quot; แล้ววางในหน้าเขียนอีเมล ระบบไม่ส่งอีเมลเอง อีเมลออกจากบัญชีของคุณ</small>
    </div>
  )
}
