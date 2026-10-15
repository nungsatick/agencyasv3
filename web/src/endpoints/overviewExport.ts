import { sql } from '@payloadcms/db-postgres'
import ExcelJS from 'exceljs'
import type { PayloadHandler } from 'payload'

import { provinceIds } from '../access'
import { bangkokDay } from '../lib/site'

/**
 * GET /api/overview-export — the overview as an Excel file: one sheet with the current totals per
 * province and one with documents / dashboards per province and fiscal year. Plain counts only.
 * Central admins get every province, province staff their own.
 */
export const overviewExport: PayloadHandler = async (req) => {
  const user = req.user as { role?: string; provinces?: (number | { id: number })[] } | null
  if (!user) return Response.json({ error: 'ต้องเข้าสู่ระบบ' }, { status: 401 })
  const isAdmin = user.role === 'admin'
  const mine = provinceIds(user)
  const db = req.payload.db.drizzle

  const provinces = await req.payload.find({ collection: 'provinces', limit: 200, depth: 0, pagination: false, sort: 'nameTh', where: isAdmin ? {} : { id: { in: mine } } })
  const scope = isAdmin ? sql`true` : sql`province_id in (${sql.join(mine.length ? mine.map((id) => sql`${id}`) : [sql`-1`], sql`, `)})`

  const counts = (
    await db.execute(sql`
      select province_id, fiscal_year, sum(docs)::int as docs, sum(dash)::int as dash, sum(drafts)::int as drafts, sum(review)::int as review from (
        select province_id, fiscal_year, count(*) filter (where _status = 'published') as docs, 0 as dash,
               count(*) filter (where _status <> 'published') as drafts, count(*) filter (where needs_review) as review
        from documents where deleted_at is null and ${scope} group by 1, 2
        union all
        select province_id, fiscal_year, 0, count(*) filter (where _status = 'published'),
               count(*) filter (where _status <> 'published'), count(*) filter (where needs_review)
        from dashboards where deleted_at is null and ${scope} group by 1, 2) t
      group by 1, 2`)
  ).rows as { province_id: number; fiscal_year: number; docs: number; dash: number; drafts: number; review: number }[]
  const visits = (await db.execute(sql`select province_id, sum(views)::int as views from page_views where ${scope} group by 1`)).rows as { province_id: number; views: number }[]
  const managers = isAdmin
    ? ((await db.execute(sql`select r.provinces_id as province_id, count(*)::int as n from users u join users_rels r on r.parent_id = u.id and r.path = 'provinces' where u.role = 'province_manager' and u.status <> 'suspended' group by 1`)).rows as { province_id: number; n: number }[])
    : []

  const years = [...new Set(counts.map((c) => Number(c.fiscal_year)))].filter(Boolean).sort((a, b) => a - b)
  const latest = years[years.length - 1]
  const key = (p: number, y: number) => `${p}:${y}`
  const cell = new Map(counts.map((c) => [key(Number(c.province_id), Number(c.fiscal_year)), c]))
  const visitBy = new Map(visits.map((v) => [Number(v.province_id), Number(v.views)]))
  const managerBy = new Map(managers.map((m) => [Number(m.province_id), Number(m.n)]))
  const sumOf = (p: number, f: 'docs' | 'dash' | 'drafts' | 'review') => years.reduce((a, y) => a + Number(cell.get(key(p, y))?.[f] ?? 0), 0)

  const wb = new ExcelJS.Workbook()
  wb.created = new Date()
  const head = (ws: ExcelJS.Worksheet) => {
    ws.getRow(1).font = { bold: true }
    ws.getRow(1).alignment = { vertical: 'middle', wrapText: true }
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
  }

  const s1 = wb.addWorksheet('ภาพรวม')
  s1.columns = [
    { header: 'จังหวัด', width: 22 },
    { header: 'รหัส', width: 8 },
    { header: `เอกสารที่เผยแพร่ ปี ${latest ?? '-'}`, width: 16 },
    { header: `แดชบอร์ดที่เผยแพร่ ปี ${latest ?? '-'}`, width: 16 },
    { header: 'เอกสารที่เผยแพร่ ทุกปี', width: 16 },
    { header: 'แดชบอร์ดที่เผยแพร่ ทุกปี', width: 16 },
    { header: 'ร่างที่ยังไม่เผยแพร่', width: 14 },
    { header: 'รายการรอตรวจ', width: 14 },
    { header: 'การเข้าชมหน้าเว็บ (ทั้งหมด)', width: 16 },
    ...(isAdmin ? [{ header: 'จำนวนบัญชีผู้ดูแลจังหวัด', width: 16 }] : []),
  ]
  for (const p of provinces.docs) {
    const now = latest ? cell.get(key(p.id, latest)) : undefined
    s1.addRow([
      p.nameTh,
      p.code,
      Number(now?.docs ?? 0),
      Number(now?.dash ?? 0),
      sumOf(p.id, 'docs'),
      sumOf(p.id, 'dash'),
      sumOf(p.id, 'drafts'),
      sumOf(p.id, 'review'),
      visitBy.get(p.id) ?? 0,
      ...(isAdmin ? [managerBy.get(p.id) ?? 0] : []),
    ])
  }
  head(s1)

  const s2 = wb.addWorksheet('รายปีงบประมาณ')
  s2.columns = [{ header: 'จังหวัด', width: 22 }, ...years.flatMap((y) => [{ header: `เอกสาร ${y}`, width: 12 }, { header: `แดชบอร์ด ${y}`, width: 13 }])]
  for (const p of provinces.docs) s2.addRow([p.nameTh, ...years.flatMap((y) => [Number(cell.get(key(p.id, y))?.docs ?? 0), Number(cell.get(key(p.id, y))?.dash ?? 0)])])
  head(s2)

  const s3 = wb.addWorksheet('คำอธิบาย')
  s3.columns = [{ width: 100 }]
  s3.addRow([`ส่งออกเมื่อ ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'long', timeStyle: 'short' })}`])
  s3.addRow(['ตัวเลขเป็นจำนวนรายการในระบบ ณ เวลาที่ส่งออก ไม่รวมรายการในถังขยะ'])
  s3.addRow(['เอกสารและแดชบอร์ดในแผ่น "รายปีงบประมาณ" นับเฉพาะรายการที่เผยแพร่แล้ว'])
  s3.addRow(['การเข้าชมหน้าเว็บ ไม่นับเจ้าหน้าที่ที่เข้าสู่ระบบและโปรแกรมอัตโนมัติ'])

  const buf = await wb.xlsx.writeBuffer()
  return new Response(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="overview-${bangkokDay()}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
