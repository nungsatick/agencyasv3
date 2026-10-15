import ExcelJS from 'exceljs'
import type { PayloadHandler } from 'payload'

import { provinceIds } from '../access'
import { phoneDigits, type RuleName, rules, tidy } from '../lib/fieldRules'
import { inviteUser } from './auth'

const ROLE_BY_LABEL: Record<string, string> = {
  ผู้ดูแลจังหวัด: 'province_manager',
  เจ้าหน้าที่จังหวัด: 'province_editor',
  ผู้ดูแลระบบส่วนกลาง: 'admin',
}
// each column and the rule it follows (lib/fieldRules.ts, the same as the add-user form)
const CHECKS: { key: 'username' | 'name' | 'nameEn' | 'position' | 'email' | 'phone'; label: string; rule: RuleName; required: boolean }[] = [
  { key: 'username', label: 'ชื่อผู้ใช้', rule: 'username', required: true },
  { key: 'name', label: 'ชื่อ นามสกุล', rule: 'name', required: true },
  { key: 'nameEn', label: 'ชื่อภาษาอังกฤษ', rule: 'nameEn', required: false },
  { key: 'position', label: 'ตำแหน่ง', rule: 'text', required: false },
  { key: 'email', label: 'อีเมล', rule: 'email', required: false },
  { key: 'phone', label: 'โทรศัพท์', rule: 'phone', required: false },
]
/** Excel turns 0812345678 typed into a number cell into 812345678: put the 0 back. */
const phoneCell = (v: string) => (/^[1-9]\d{7,8}$/.test(v) ? `0${v}` : v)
const MAX_ROWS = 500

type Parsed = { row: number; username: string; name: string; nameEn: string; position: string; email: string; phone: string; role: string; provinceId?: number; province: string; errors: string[] }

const cell = (v: ExcelJS.CellValue): string => {
  if (v == null) return ''
  if (typeof v === 'object' && 'text' in v) return String(v.text).trim() // hyperlink cells
  if (typeof v === 'object' && 'richText' in v) return v.richText.map((r) => r.text).join('').trim()
  return String(v).trim()
}

/**
 * POST /api/users/import (multipart: file=<xlsx>, confirm=1 to create)
 * Reads the template's first sheet (username, name, position, email, phone, role, province, English name),
 * every box checked with the same rules as the add-user form (lib/fieldRules.ts).
 * Without confirm it only validates and reports; with confirm it creates the valid rows as
 * invited accounts and returns their one-time activation links (shown once).
 */
export const importUsers: PayloadHandler = async (req) => {
  const actor = req.user as { id: number; role?: string; provinces?: (number | { id: number })[] } | null
  if (!actor || !['admin', 'province_manager'].includes(actor.role ?? '')) return Response.json({ error: 'ไม่มีสิทธิ์นำเข้าผู้ใช้' }, { status: 403 })

  const form = await req.formData!()
  const file = form.get('file')
  if (!(file instanceof File)) return Response.json({ error: 'ไม่พบไฟล์' }, { status: 400 })
  const confirm = form.get('confirm') === '1'

  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(await file.arrayBuffer())
  } catch {
    return Response.json({ error: 'อ่านไฟล์ไม่ได้ ต้องเป็นไฟล์ .xlsx ตามไฟล์ต้นแบบ' }, { status: 400 })
  }
  const ws = wb.worksheets[0]
  if (!ws) return Response.json({ error: 'ไฟล์ไม่มีแผ่นงาน' }, { status: 400 })

  const provinces = await req.payload.find({ collection: 'provinces', limit: 200, depth: 0, pagination: false })
  const provinceByName = new Map(provinces.docs.map((p) => [p.nameTh, p.id]))
  const existing = await req.payload.find({ collection: 'users', limit: 100000, depth: 0, pagination: false, overrideAccess: true, select: { username: true } })
  const taken = new Set(existing.docs.map((u) => u.username))
  const mine = provinceIds(actor)

  const rows: Parsed[] = []
  const seen = new Set<string>()
  ws.eachRow((r, n) => {
    if (n === 1) return
    // columns A–G as before; H (English name) was added later, so older filled-in files still import
    const v = [1, 2, 3, 4, 5, 6, 7, 8].map((c) => cell(r.getCell(c).value))
    // The pre-filled template has rows with only role and province: skip rows nobody filled in.
    if (!v[0] && !v[1]) return
    const p: Parsed = {
      row: n,
      username: v[0].toLowerCase(),
      name: tidy(v[1]),
      position: tidy(v[2]),
      email: v[3],
      phone: phoneCell(v[4]),
      role: ROLE_BY_LABEL[v[5]] ?? '',
      province: v[6],
      nameEn: tidy(v[7]),
      errors: [],
    }
    for (const c of CHECKS) {
      const msg = rules[c.rule](p[c.key], { required: c.required })
      if (msg) p.errors.push(`${c.label}: ${msg}`)
    }
    if (!p.errors.some((e) => e.startsWith('ชื่อผู้ใช้:'))) {
      if (taken.has(p.username)) p.errors.push('ชื่อผู้ใช้: ซ้ำกับบัญชีที่มีอยู่แล้ว')
      else if (seen.has(p.username)) p.errors.push('ชื่อผู้ใช้: ซ้ำกับแถวอื่นในไฟล์')
    }
    seen.add(p.username)
    if (p.phone) p.phone = phoneDigits(p.phone)
    if (!p.role) p.errors.push('บทบาท: ไม่ถูกต้อง เลือกจากรายการ')
    p.provinceId = provinceByName.get(p.province)
    if (p.role && p.role !== 'admin' && !p.provinceId) p.errors.push(p.province ? 'จังหวัด: ไม่พบจังหวัดนี้' : 'จังหวัด: ยังไม่ได้เลือก')
    if (actor.role !== 'admin') {
      if (p.role !== 'province_editor') p.errors.push('ผู้ดูแลจังหวัดนำเข้าได้เฉพาะบทบาทเจ้าหน้าที่จังหวัด')
      if (p.provinceId && !mine.includes(p.provinceId)) p.errors.push('นำเข้าได้เฉพาะจังหวัดของตัวเอง')
    }
    rows.push(p)
  })
  if (rows.length > MAX_ROWS) return Response.json({ error: `นำเข้าได้ครั้งละไม่เกิน ${MAX_ROWS} คน` }, { status: 400 })

  const ready = rows.filter((r) => r.errors.length === 0)
  const invalid = rows.filter((r) => r.errors.length > 0).map((r) => ({ row: r.row, username: r.username, errors: r.errors }))
  if (!confirm) return Response.json({ total: rows.length, ready: ready.length, invalid })

  const created: { row: number; username: string; name: string; url: string; expiresAt: string }[] = []
  for (const r of ready) {
    try {
      const { link } = await inviteUser(req, { ...r, provinces: r.provinceId ? [r.provinceId] : [] })
      created.push({ row: r.row, username: r.username, name: r.name, url: link.url, expiresAt: link.expiresAt })
    } catch (e) {
      invalid.push({ row: r.row, username: r.username, errors: [(e as Error).message] })
    }
  }
  return Response.json({ total: rows.length, created, invalid })
}
