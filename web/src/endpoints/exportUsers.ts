import ExcelJS from 'exceljs'
import type { PayloadHandler } from 'payload'

import { bangkokDay } from '../lib/site'
import { usersListWhere } from '../lib/usersList'
import type { User } from '../payload-types'

const ROLE: Record<string, string> = { admin: 'ผู้ดูแลระบบส่วนกลาง', province_manager: 'ผู้ดูแลจังหวัด', province_editor: 'เจ้าหน้าที่จังหวัด' }
const STATUS: Record<string, string> = { invited: 'รอเปิดใช้บัญชี', active: 'ใช้งานอยู่', suspended: 'ถูกระงับ' }

const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' }) : '')

/**
 * GET /api/users/export — the users list as an Excel file, with the same filters as the screen.
 * Goes through the collection's read access, so province managers only get the accounts they manage.
 */
export const exportUsers: PayloadHandler = async (req) => {
  const actor = req.user as { role?: string } | null
  if (!actor) return Response.json({ error: 'ต้องเข้าสู่ระบบ' }, { status: 401 })
  if (!['admin', 'province_manager'].includes(actor.role ?? '')) return Response.json({ error: 'ไม่มีสิทธิ์ส่งออกรายชื่อผู้ใช้' }, { status: 403 })

  const and = usersListWhere(Object.fromEntries(new URL(req.url!).searchParams))
  const users = await req.payload.find({ collection: 'users', where: and.length ? { and } : {}, sort: 'username', pagination: false, depth: 0, user: req.user, overrideAccess: false })
  const provinces = await req.payload.find({ collection: 'provinces', limit: 200, depth: 0, pagination: false })
  const provinceName = new Map(provinces.docs.map((p) => [p.id, p.nameTh]))
  const provinceNames = (u: User) =>
    u.role === 'admin' ? 'ทุกจังหวัด' : (u.provinces ?? []).map((p) => provinceName.get(typeof p === 'object' ? p.id : p) ?? '').filter(Boolean).join(', ')

  const wb = new ExcelJS.Workbook()
  wb.created = new Date()
  const ws = wb.addWorksheet('ผู้ใช้')
  ws.columns = [
    { header: 'ชื่อผู้ใช้', width: 22 },
    { header: 'ชื่อ นามสกุล', width: 28 },
    { header: 'ชื่อ-นามสกุล (ภาษาอังกฤษ)', width: 28 },
    { header: 'ตำแหน่ง', width: 28 },
    { header: 'อีเมล', width: 32 },
    { header: 'โทรศัพท์', width: 16 },
    { header: 'บทบาท', width: 22 },
    { header: 'จังหวัด', width: 22 },
    { header: 'สถานะ', width: 16 },
    { header: '2FA', width: 14 },
    { header: 'เข้าสู่ระบบล่าสุด', width: 16 },
    { header: 'สร้างบัญชีเมื่อ', width: 16 },
  ]
  for (const u of users.docs) {
    ws.addRow([
      u.username,
      u.name,
      u.nameEn ?? '',
      u.position ?? '',
      u.email ?? '',
      u.phone ?? '',
      ROLE[u.role] ?? u.role,
      provinceNames(u),
      STATUS[u.status ?? 'active'] ?? u.status,
      u.totpConfirmedAt ? 'ตั้งค่าแล้ว' : 'ยังไม่ตั้งค่า',
      day(u.lastLoginAt),
      day(u.createdAt),
    ])
  }
  ws.getRow(1).font = { bold: true }
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
  ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columnCount } }

  const buf = await wb.xlsx.writeBuffer()
  return new Response(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="users-${bangkokDay()}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
