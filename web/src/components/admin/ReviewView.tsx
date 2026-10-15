import { sql } from '@payloadcms/db-postgres'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { Shell, type Staff, staffProvinces } from './Shell'
import { SortTable } from './SortTable'

type Item = { kind: 'documents' | 'dashboards'; id: number; title: string; fiscal_year: number; status: string; legacy_title: string | null; has_file: boolean }

/**
 * /admin/review — items brought over from the old site that still need a person to look at them
 * (no real file, unclear type, ...). Central admins start from a per-province summary.
 */
export async function ReviewView(props: AdminViewServerProps) {
  const { req } = props.initPageResult
  const user = req.user as Staff | null
  if (!user) redirect('/login')
  const isAdmin = user.role === 'admin'
  const sp = (await props.searchParams) ?? {}
  const db = req.payload.db.drizzle

  const provinces = await req.payload.find({ collection: 'provinces', limit: 200, depth: 0, pagination: false, sort: 'nameTh', where: isAdmin ? {} : { id: { in: staffProvinces(user) } } })
  const one = isAdmin ? (provinces.docs.find((p) => p.id === Number(sp.province)) ?? null) : (provinces.docs[0] ?? null)
  if (!isAdmin && !one) redirect('/admin')

  if (!one) {
    const rows = (
      await db.execute(sql`
        select province_id, sum(docs)::int as docs, sum(dash)::int as dash from (
          select province_id, count(*) as docs, 0 as dash from documents where needs_review and deleted_at is null group by 1
          union all
          select province_id, 0, count(*) from dashboards where needs_review and deleted_at is null group by 1) t
        group by 1`)
    ).rows as { province_id: number; docs: number; dash: number }[]
    const by = new Map(rows.map((r) => [Number(r.province_id), r]))
    const list = provinces.docs.filter((p) => by.has(p.id)).sort((a, b) => Number(by.get(b.id)!.docs) + Number(by.get(b.id)!.dash) - Number(by.get(a.id)!.docs) - Number(by.get(a.id)!.dash))
    const total = rows.reduce((a, r) => a + Number(r.docs) + Number(r.dash), 0)
    return (
      <Shell {...props} title="รายการรอตรวจ">
        <div className="agy">
          <div className="agy__head">
            <div>
              <h1>รายการรอตรวจ</h1>
              <p className="agy__sub">รายการที่ย้ายมาจากเว็บเดิมและต้องให้คนตรวจ เช่น ไม่มีไฟล์จริง หรือจัดประเภทไม่ได้ รวม {total.toLocaleString('th-TH')} รายการ ใน {list.length} จังหวัด</p>
            </div>
          </div>
          {list.length === 0 ? (
            <div className="agy__card">ไม่มีรายการรอตรวจ</div>
          ) : (
            <SortTable
              columns={[{ label: 'จังหวัด' }, { label: 'เอกสาร', className: 'num' }, { label: 'แดชบอร์ด', className: 'num' }, { label: <span className="sr-only">ลิงก์</span>, sortable: false }]}
              rows={list.map((p) => {
                const r = by.get(p.id)!
                const [d, b] = [Number(r.docs), Number(r.dash)]
                return {
                  key: p.id,
                  sort: [p.nameTh, d, b, null],
                  cellClass: [undefined, d ? 'num' : 'num zero', b ? 'num' : 'num zero', undefined],
                  cells: [<strong key="n">{p.nameTh}</strong>, d, b, <Link key="l" href={`/admin/review?province=${p.id}`}>ดูรายการ</Link>],
                }
              })}
            />
          )}
        </div>
      </Shell>
    )
  }

  const items = (
    await db.execute(sql`
      select 'documents' as kind, d.id, d.title, d.fiscal_year, d._status::text as status, d.legacy_title,
             exists(select 1 from documents_rels r where r.parent_id = d.id and r.files_id is not null) or coalesce(d.external_url, '') <> '' as has_file
      from documents d where d.needs_review and d.deleted_at is null and d.province_id = ${one.id}
      union all
      select 'dashboards', b.id, b.title, b.fiscal_year, b._status::text, b.legacy_title, coalesce(b.embed_url, '') <> ''
      from dashboards b where b.needs_review and b.deleted_at is null and b.province_id = ${one.id}
      order by fiscal_year desc, kind, title`)
  ).rows as Item[]

  return (
    <Shell {...props} title="รายการรอตรวจ">
      <div className="agy">
        <div className="agy__head">
          <div>
            <h1>รายการรอตรวจ จังหวัด{one.nameTh}</h1>
            <p className="agy__sub">
              {items.length} รายการ เปิดรายการเพื่อแก้ไข เมื่อตรวจแล้วให้เอาเครื่องหมาย &quot;รอตรวจ&quot; ออก (ในกล่อง &quot;ข้อมูลจากเว็บเดิม&quot;) แล้วบันทึก
            </p>
          </div>
          {isAdmin && <Link className="agy__btn" href="/admin/review">ทุกจังหวัด</Link>}
        </div>
        {items.length === 0 ? (
          <div className="agy__card">ไม่มีรายการรอตรวจ</div>
        ) : (
          <SortTable
            columns={[{ label: 'ปี' }, { label: 'ชนิด' }, { label: 'ชื่อ' }, { label: 'สถานะ' }, { label: 'สิ่งที่ควรตรวจ' }]}
            rows={items.map((i) => {
              const kind = i.kind === 'documents' ? 'เอกสาร' : 'แดชบอร์ด'
              const todo = i.has_file ? 'ตรวจประเภทและชื่อ' : i.kind === 'documents' ? 'ไม่มีไฟล์ ต้องแนบไฟล์ก่อนเผยแพร่' : 'ไม่มีลิงก์แดชบอร์ด'
              return {
                key: `${i.kind}-${i.id}`,
                sort: [i.fiscal_year, kind, i.title, i.status, todo],
                cells: [
                  i.fiscal_year,
                  kind,
                  <span key="t">
                    <Link href={`/admin/collections/${i.kind}/${i.id}`}><strong>{i.title}</strong></Link>
                    {i.legacy_title && i.legacy_title !== i.title && <span className="agy__sub" style={{ display: 'block' }}>ชื่อในเว็บเดิม: {i.legacy_title}</span>}
                  </span>,
                  <span key="s" className={i.status === 'published' ? 'agy__pill agy__pill--ok' : 'agy__pill agy__pill--wait'}>{i.status === 'published' ? 'เผยแพร่แล้ว' : 'ร่าง'}</span>,
                  todo,
                ],
              }
            })}
          />
        )}
      </div>
    </Shell>
  )
}
