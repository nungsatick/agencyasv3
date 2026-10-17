'use client'

import { usePathname } from 'next/navigation'
import React, { useEffect } from 'react'

import { NavHighlight } from './NavHighlight'
import { NavRail } from './NavRail'
import { PayloadDates } from './PayloadDates'
import { CreateTitle } from './CreateTitle'
import { IdleGuard } from './IdleGuard'
import { RoleClass } from './RoleClass'

/**
 * Short explanations for form fields, shown from a small ⓘ after the field's label (on hover,
 * keyboard focus or a tap). Keyed by collection (or global) and field path; a path inside a group
 * is written with dots, e.g. "mourning.enabled".
 */
const HINTS: Record<string, Record<string, string>> = {
  documents: {
    province: 'จังหวัดเจ้าของเอกสาร เอกสารจะแสดงในหน้าเว็บของจังหวัดนี้',
    fiscalYear: 'ปีงบประมาณ (พ.ศ.) ที่เอกสารนี้เป็นของ ใช้แยกเอกสารตามปีในหน้าเว็บ',
    type: 'ชนิดของเอกสาร เช่น รายงานการประชุม หรือ Template 1 ใช้กำหนดหัวข้อที่เอกสารไปแสดง และช่องที่ต้องกรอก',
    title: 'ชื่อที่แสดงบนหน้าเว็บ ระบบเสนอชื่อมาตรฐานจากประเภท ครั้งที่ และปีให้ พิมพ์ทับได้',
    meetingNo: 'ครั้งที่ของการประชุมในปีงบประมาณนั้น ใช้รวมเอกสารของการประชุมครั้งเดียวกันไว้ด้วยกัน',
    meetingDate: 'วันที่จัดประชุม แสดงที่หัวการ์ดของการประชุมบนหน้าเว็บ',
    topic: 'หมวดประเด็น เช่น เกษตร สาธารณภัย ใช้จัดกลุ่มและกำหนดสีของรายการบนหน้าเว็บ',
    issueTitle: 'ชื่อประเด็นการพัฒนาของจังหวัด เอกสาร Template 1–3 ที่ใช้ชื่อเดียวกันจะรวมอยู่ในการ์ดเดียวกัน',
    description: 'ข้อความสั้น ๆ ใต้ชื่อเอกสาร ไม่บังคับ',
    files: 'ไฟล์ที่ผู้เข้าชมเปิดดูหรือดาวน์โหลดได้ แทนที่ไฟล์ได้โดยลิงก์เดิมไม่เปลี่ยน และดูประวัติไฟล์ได้',
    externalUrl: 'ใช้เมื่อเอกสารอยู่ที่เว็บไซต์อื่น ใส่ลิงก์แทนการแนบไฟล์ (เผยแพร่ได้เมื่อมีไฟล์แนบหรือลิงก์นี้อย่างน้อยหนึ่งอย่าง)',
    sortOrder: 'เลขน้อยแสดงก่อน ใช้เมื่ออยากจัดลำดับเอกสารในหัวข้อเดียวกันเอง ปกติไม่ต้องแก้',
    needsReview: 'รายการที่ย้ายมาจากเว็บเดิมและต้องให้คนตรวจ เอาเครื่องหมายออกเมื่อตรวจแล้ว',
  },
  dashboards: {
    province: 'จังหวัดเจ้าของแดชบอร์ด',
    fiscalYear: 'ปีงบประมาณ (พ.ศ.) ของแดชบอร์ด',
    topic: 'หมวดประเด็น ใช้เป็นตัวกรองและสีของการ์ดบนหน้าเว็บ',
    title: 'ชื่อที่แสดงบนการ์ดแดชบอร์ด',
    description: 'ข้อความอธิบายสั้น ๆ ไม่บังคับ',
    provider: 'บริการที่ใช้สร้างแดชบอร์ด เช่น Power BI',
    embedUrl: 'ลิงก์แบบ "เผยแพร่สู่เว็บ" (Publish to web) ของแดชบอร์ด ผู้เข้าชมต้องเปิดดูได้โดยไม่ต้องเข้าสู่ระบบ',
    thumbnail: 'ภาพหน้าปกบนการ์ด ระบบจับภาพหน้าแรกให้อัตโนมัติ อัปโหลดภาพของตัวเองแทนได้',
    files: 'เอกสารที่เกี่ยวกับแดชบอร์ดนี้ ไม่บังคับ',
    pinned: 'หน้าหลักของจังหวัดแสดงแดชบอร์ด 4 ใบ: ใบที่ปักหมุดก่อน แล้วเติมด้วยแดชบอร์ดล่าสุดจนครบ ถ้าปักหมุดเกิน 4 ใบ จะแสดง 4 ใบที่ปีใหม่กว่า',
    sortOrder: 'เลขน้อยแสดงก่อน ในปีและประเด็นเดียวกัน ปกติไม่ต้องแก้',
  },
  provinces: {
    nameTh: 'ชื่อจังหวัดที่แสดงบนหัวหน้าเว็บ',
    code: 'รหัสย่อ 3 ตัวของจังหวัด ใช้จับคู่ตราประจำจังหวัด แก้ไม่ได้',
    slug: 'ส่วนท้ายของที่อยู่เว็บจังหวัด เช่น /sisaket แก้ไม่ได้ เพื่อให้ลิงก์เดิมยังใช้ได้',
    ckanUrl: 'ที่อยู่ระบบบัญชีข้อมูล (CKAN) ของจังหวัด ใช้กับปุ่ม "ค้นหาชุดข้อมูล" บนหน้าหลัก',
    officeName: 'ชื่อสำนักงานที่แสดงในส่วนท้ายของหน้าเว็บ',
    address: 'ที่อยู่สำนักงาน แสดงในส่วนท้ายของหน้าเว็บ',
    phone: 'เบอร์โทรศัพท์สำนักงาน',
    fax: 'เบอร์โทรสาร เว้นว่างได้ถ้าไม่มี',
    email: 'อีเมลติดต่อสำนักงาน ผู้เข้าชมกดแล้วเปิดโปรแกรมส่งอีเมลได้',
    website: 'เว็บไซต์สำนักงานสถิติจังหวัด',
    mapUrl: 'ลิงก์ Google Maps ของสำนักงาน เว้นว่างได้ ระบบจะค้นหาจากชื่อสำนักงานให้',
    theme: 'ชุดสีของหน้าเว็บจังหวัด มีผลทั้งหน้าเว็บเมื่อกดบันทึก',
    heroImage: 'ภาพใหญ่ด้านบนของหน้าหลัก แนะนำขนาด 2400 × 1000 พิกเซล',
    heroTextSide: 'ข้อความบนภาพอยู่ฝั่งไหน ควรเลือกฝั่งที่ภาพเรียบ ไม่มีจุดเด่น',
    heroCredit: 'ที่มาหรือเจ้าของภาพ แสดงในแถบล่างสุดของหน้าเว็บ',
  },
  users: {
    username: 'ชื่อที่ใช้เข้าสู่ระบบ ภาษาอังกฤษพิมพ์เล็ก ตัวเลข จุด หรือขีด',
    name: 'ชื่อ นามสกุล ภาษาไทย ใช้แสดงในหลังบ้านและประวัติการใช้งาน',
    position: 'ตำแหน่งงาน ไม่บังคับ',
    phone: 'เบอร์ติดต่อ ไม่บังคับ',
    email: 'อีเมลติดต่อ ไม่บังคับ ระบบไม่ส่งอีเมล',
    role: 'ผู้ดูแลระบบส่วนกลาง: ทุกจังหวัด · ผู้ดูแลจังหวัด: จังหวัดตัวเองและเพิ่มเจ้าหน้าที่ได้ · เจ้าหน้าที่จังหวัด: เนื้อหาของจังหวัดตัวเอง',
    provinces: 'จังหวัดที่บัญชีนี้แก้ไขเนื้อหาได้',
    status: 'รอเปิดใช้บัญชี / ใช้งานอยู่ / ถูกระงับ เปลี่ยนด้วยปุ่มด้านบนของหน้านี้',
    totpConfirmedAt: 'วันที่เจ้าของบัญชีตั้งค่ายืนยันตัวตนสองขั้น (2FA) ว่าง = ยังไม่ได้ตั้งค่า',
    lastLoginAt: 'เข้าสู่ระบบครั้งล่าสุด บัญชีที่ไม่ได้เข้าเกิน 365 วันจะถูกระงับอัตโนมัติ (ยกเว้นผู้ดูแลระบบส่วนกลาง)',
    passwordSetAt: 'วันที่เจ้าของบัญชีตั้งหรือเปลี่ยนรหัสผ่านครั้งล่าสุด',
  },
  announcements: {
    title: 'ชื่อเรียกประกาศในหลังบ้าน (บังคับ) ไม่แสดงบนป๊อปอัป แต่โปรแกรมอ่านหน้าจอใช้เป็นชื่อป๊อปอัป',
    body: 'ข้อความสั้น ๆ ใต้ภาพ ตัวอักษรขนาดเล็ก ไม่บังคับ ประกาศต้องมีภาพหรือคำอธิบายอย่างน้อยหนึ่งอย่าง',
    image: 'ภาพประกาศ มีภาพอย่างเดียวก็เผยแพร่ได้ ระบบแสดงทั้งภาพโดยไม่ตัดขอบ',
    imageAlt: 'บรรยายภาพสั้น ๆ สำหรับผู้ใช้โปรแกรมอ่านหน้าจอ ไม่แสดงบนหน้าเว็บ ไม่บังคับ เว้นว่างระบบใช้หัวข้อแทน',
    buttonLabel: 'ข้อความบนปุ่ม เช่น "อ่านเพิ่มเติม" ไม่บังคับ',
    buttonUrl: 'ลิงก์ที่ปุ่มพาไป ถ้าไม่กรอกข้อความบนปุ่ม การกดที่ภาพจะพาไปลิงก์นี้',
    startsAt: 'วันเวลาที่เริ่มแสดง',
    endsAt: 'วันเวลาที่หยุดแสดงเอง เว้นว่าง = แสดงจนกว่าจะกดหยุดเผยแพร่',
    allProvinces: 'ติ๊ก = แสดงทุกจังหวัด เอาออกเพื่อเลือกเฉพาะบางจังหวัด',
    provinces: 'จังหวัดที่จะแสดงป๊อปอัปนี้',
    showOn: 'แสดงเฉพาะหน้าหลักของจังหวัด หรือทุกหน้า',
    frequency: 'ผู้เข้าชมคนเดิมเห็นบ่อยแค่ไหน',
    priority: 'ถ้ามีหลายประกาศในช่วงเดียวกัน เลขมากแสดงก่อน',
  },
  'central-contents': {
    section: 'กลุ่มในหน้า "แผนงานและคู่มือ" ของทุกจังหวัด: แผนการขับเคลื่อน (กรองตามปีงบได้) หรือคู่มือและสื่อสนับสนุน (แสดงทุกปีเสมอ)',
    fiscalYear: 'ใช้กับกลุ่มแผนการขับเคลื่อน หัวข้อจะแสดงเมื่อผู้เข้าชมเลือกปีนี้ เว้นว่างถ้าใช้ได้ทุกปี (แสดงเสมอ อยู่ก่อนหัวข้อที่มีปี)',
    sortOrder: 'ระบบตั้งให้เอง (หัวข้อใหม่ต่อท้ายกลุ่ม) เลื่อนลำดับได้ด้วยปุ่ม ▲▼ ในรายการเนื้อหากลาง',
    title: 'หัวข้อที่แสดงบนหน้าเว็บ',
    slug: 'ระบบตั้งให้เอง ใช้เป็นลิงก์ตรงไปหัวข้อนี้ เช่น /sisaket/guides#รหัส ไม่จำเป็นต้องแก้',
    body: 'เนื้อหาข้อความ',
    sourceUrl: 'แหล่งที่มาของเนื้อหา',
    files: 'ไฟล์หรือภาพที่แสดงในหัวข้อนี้',
    links: 'รายการที่แสดงเป็นข้อ ๆ มีเลขลำดับ แต่ละข้อใส่ลิงก์หรือเลือกไฟล์อย่างใดอย่างหนึ่ง (ถ้ามีทั้งสองใช้ไฟล์) ถ้าไม่ใส่เลยจะแสดงเป็นข้อความธรรมดา กดไม่ได้'
  },
  topics: {
    nameTh: 'ชื่อประเด็นที่แสดงบนป้ายและตัวกรองของหน้าเว็บ',
    color: 'สีของป้ายประเด็น เว้นว่าง = สีเดิมหรือสีเทา',
    sortOrder: 'ลำดับในตัวกรองประเด็น เลขน้อยแสดงก่อน',
    slug: 'ระบบตั้งให้เอง ใช้ในลิงก์กรองประเด็น',
  },
  'site-settings': {
    'mourning.enabled': 'เปิดแล้วหน้าเว็บทุกจังหวัดเป็นโทนขาวดำ พร้อมริบบิ้นสีดำ',
    'mourning.startsOn': 'วันที่เริ่ม เว้นว่าง = เริ่มทันที',
    'mourning.endsOn': 'ระบบปิดโหมดไว้ทุกข์ให้เองเมื่อพ้นวันนี้',
    'mourning.ribbonCorner': 'มุมที่แสดงริบบิ้นสีดำ',
    'mourning.grayscale': 'ทำให้หน้าเว็บ รวมภาพและตราจังหวัด เป็นโทนขาวดำ',
    'mourning.grayLevel': '100 = ขาวดำทั้งหมด ค่าน้อยลงจะเหลือสีเดิมมากขึ้น (10–100)',
    'mourning.ribbon': 'แสดงริบบิ้นสีดำที่มุมบนของหน้าเว็บ',
    'mourning.keepEmbeds': 'ให้แดชบอร์ดยังมีสี เพื่อให้อ่านกราฟได้',
    'mourning.message': 'ข้อความไว้อาลัยใต้แถบเมนู ไม่บังคับ',
    copyrightText: 'ข้อความต่อจาก © ปี ในแถบล่างสุด',
    footerNote: 'ข้อความเพิ่มเติมในแถบล่างสุด ไม่บังคับ',
    showStaffLogin: 'แสดงลิงก์ "เข้าสู่ระบบเจ้าหน้าที่" ในส่วนท้าย',
    showMapLink: 'แสดงลิงก์ "ดูแผนที่" ใต้ที่อยู่สำนักงาน',
    footerLinks: 'ลิงก์เพิ่มเติมในคอลัมน์ "เมนู" ของส่วนท้าย ทุกจังหวัด',
    policyVersion: 'เพิ่มเลขเมื่อแก้สาระสำคัญของนโยบาย ระบบจะขอความยินยอมเรื่องคุกกี้จากผู้เข้าชมใหม่',
    privacyPolicy: 'ข้อความหน้านโยบายความเป็นส่วนตัว',
    cookiePolicy: 'ข้อความหน้านโยบายคุกกี้',
  },
}

/** Which form is open: "documents" for /admin/collections/documents/..., "site-settings" for /admin/globals/site-settings. */
const formOf = (path: string) => /\/admin\/(?:collections|globals)\/([^/?#]+)/.exec(path)?.[1] ?? ''

function addHints(root: ParentNode, hints: Record<string, string>) {
  for (const label of Array.from(root.querySelectorAll<HTMLLabelElement>('label.field-label[for]'))) {
    if (label.querySelector('.agy-hint')) continue
    // Payload names the input "field-" + the path, with "__" between group and field
    const key = (label.getAttribute('for') ?? '').replace(/^field-/, '').replace(/__/g, '.')
    const text = hints[key]
    if (!text) continue
    const hint = document.createElement('span')
    hint.className = 'agy-hint'
    hint.tabIndex = 0
    hint.setAttribute('role', 'button')
    hint.setAttribute('aria-label', `คำอธิบาย: ${text}`)
    hint.textContent = 'i'
    const bubble = document.createElement('span')
    bubble.className = 'agy-hint__bubble'
    bubble.setAttribute('role', 'tooltip')
    bubble.textContent = text
    hint.appendChild(bubble)
    // a tap on a touch screen toggles it; clicking must not focus the input behind the label
    hint.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      hint.classList.toggle('is-open')
    })
    hint.addEventListener('blur', () => hint.classList.remove('is-open'))
    label.appendChild(hint)
  }
}

/** Wraps the backoffice and adds the ⓘ hints to whichever form is on screen. */
export function FieldHints({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  useEffect(() => {
    const hints = HINTS[formOf(path)]
    if (!hints) return
    addHints(document, hints)
    // fields appear later (collapsed sections, conditions, client rendering): watch for them
    const obs = new MutationObserver(() => addHints(document, hints))
    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [path])
  return (
    <>
      <NavHighlight />
      <NavRail />
      <PayloadDates />
      <RoleClass />
      <IdleGuard />
      <CreateTitle />
      {children}
    </>
  )
}
