import { sql } from '@payloadcms/db-postgres'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { topicColor } from '@/lib/themes'

import { Shell, type Staff, staffProvinces } from './Shell'
import { SortTable } from './SortTable'

type Missing = { kind: 'dashboards' | 'documents'; id: number; title: string; fiscal_year: number; status: string; province: string; type: string | null }

/**
 * /admin/topic-report — topics with how much uses them, and the dashboards (and topic-type
 * documents) that have no topic yet. Central admins see every province, province staff their own.
 */
export async function TopicReportView(props: AdminViewServerProps) {
  const { req } = props.initPageResult
  const user = req.user as Staff | null
  if (!user) redirect('/login')
  const isAdmin = user.role === 'admin'
  const mine = staffProvinces(user)
  const scope = isAdmin ? sql`true` : sql`x.province_id in (${sql.join(mine.length ? mine.map((id) => sql`${id}`) : [sql`-1`], sql`, `)})`
  const db = req.payload.db.drizzle

  const topics = (
    await db.execute(sql`
      select t.id, t.name_th, t.slug, t.color::text as color, t.sort_order,
             (select count(*) from documents x where x.topic_id = t.id and x.deleted_at is null and ${scope})::int as docs,
             (select count(*) from dashboards x where x.topic_id = t.id and x.deleted_at is null and ${scope})::int as dash
      from topics t order by t.sort_order, t.name_th`)
  ).rows as { id: number; name_th: string; slug: string; color: string | null; docs: number; dash: number }[]

  // dashboards with no topic, and documents whose type expects one (datasets, analysis specs)
  const missing = (
    await db.execute(sql`
      select 'dashboards' as kind, x.id, x.title, x.fiscal_year, x._status::text as status, p.name_th as province, null as type
      from dashboards x join provinces p on p.id = x.province_id
      where x.topic_id is null and x.deleted_at is null and ${scope}
      union all
      select 'documents', x.id, x.title, x.fiscal_year, x._status::text, p.name_th, dt.name_th
      from documents x join provinces p on p.id = x.province_id join document_types dt on dt.id = x.type_id
      where x.topic_id is null and dt.has_topic and x.deleted_at is null and ${scope}
      order by 1, 6, 4 desc, 3`)
  ).rows as Missing[]
  const dash = missing.filter((m) => m.kind === 'dashboards')
  const docs = missing.filter((m) => m.kind === 'documents')
  const byProvince = (rows: Missing[]) => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.province, (m.get(r.province) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }

  const pill = (status: string) => (
    <span className={status === 'published' ? 'agy__pill agy__pill--ok' : 'agy__pill agy__pill--wait'}>{status === 'published' ? 'เผยแพร่แล้ว' : 'ร่าง'}</span>
  )
  const list = (rows: Missing[], withType: boolean) => (
    <SortTable
      columns={[...(isAdmin ? [{ label: 'จังหวัด' }] : []), { label: 'ปี' }, ...(withType ? [{ label: 'ประเภท' }] : []), { label: 'ชื่อ' }, { label: 'สถานะ' }]}
      rows={rows.slice(0, 300).map((r) => ({
        key: `${r.kind}-${r.id}`,
        sort: [...(isAdmin ? [r.province] : []), r.fiscal_year, ...(withType ? [r.type] : []), r.title, r.status],
        cells: [
          ...(isAdmin ? [r.province] : []),
          r.fiscal_year,
          ...(withType ? [r.type] : []),
          <Link key="t" href={`/admin/collections/${r.kind}/${r.id}`}>{r.title}</Link>,
          pill(r.status),
        ],
      }))}
    />
  )

  return (
    <Shell {...props} title="รายงานประเด็น">
      <div className="agy">
        <div className="agy__head">
          <div>
            <h1>รายงานประเด็น</h1>
            <p className="agy__sub">
              ประเด็นที่ใช้จัดกลุ่มแดชบอร์ดและเอกสาร และรายการที่ยังไม่ได้จัดเข้าประเด็นใด{isAdmin ? ' (ทุกจังหวัด)' : ' (เฉพาะจังหวัดของคุณ)'} · รายการที่ไม่มีประเด็นจะไม่ขึ้นในตัวกรองประเด็นบนหน้าเว็บ
            </p>
          </div>
          {isAdmin && (
            <div className="agy__actions">
              <Link className="agy__btn" href="/admin/collections/topics">จัดการประเด็น</Link>
              <Link className="agy__btn agy__btn--primary" href="/admin/collections/topics/create">เพิ่มประเด็น</Link>
            </div>
          )}
        </div>

        <div className="agy__tiles">
          <div className="agy__tile"><span>จำนวนประเด็น</span><strong>{topics.length}</strong></div>
          <Link className={dash.length ? 'agy__tile agy__tile--warn' : 'agy__tile'} href="#no-topic-dashboards">
            <span>แดชบอร์ดที่ยังไม่มีประเด็น</span><strong>{dash.length}</strong>
          </Link>
          <Link className={docs.length ? 'agy__tile agy__tile--warn' : 'agy__tile'} href="#no-topic-documents">
            <span>ชุดข้อมูลและข้อกำหนดการวิเคราะห์ที่ยังไม่มีประเด็น</span><strong>{docs.length}</strong>
          </Link>
        </div>

        <h2 className="agy__h2">ประเด็นทั้งหมด</h2>
        <SortTable
          columns={[
            { label: 'ประเด็น' },
            { label: 'แดชบอร์ด', className: 'num' },
            { label: 'เอกสาร', className: 'num' },
            { label: <span className="sr-only">ลิงก์</span>, sortable: false },
          ]}
          rows={topics.map((t) => ({
            key: t.id,
            sort: [t.name_th, Number(t.dash), Number(t.docs), null],
            cellClass: [undefined, Number(t.dash) ? 'num' : 'num zero', Number(t.docs) ? 'num' : 'num zero', undefined],
            cells: [
              <span key="n">
                <span className="agy-topic__swatch" style={{ background: topicColor(t).dot }} />
                <strong>{t.name_th}</strong>
              </span>,
              t.dash,
              t.docs,
              isAdmin ? <Link key="e" href={`/admin/collections/topics/${t.id}`}>แก้ไข</Link> : null,
            ],
          }))}
        />

        <h2 className="agy__h2" id="no-topic-dashboards">แดชบอร์ดที่ยังไม่มีประเด็น ({dash.length})</h2>
        {dash.length === 0 ? (
          <p className="agy__sub">ทุกแดชบอร์ดมีประเด็นแล้ว</p>
        ) : (
          <>
            {isAdmin && (
              <p className="agy__sub">
                แยกตามจังหวัด: {byProvince(dash).map(([p, n]) => `${p} ${n}`).join(' · ')}
              </p>
            )}
            <p className="agy__sub">กดชื่อเพื่อเปิด แล้วเลือก "ประเด็น" และบันทึก</p>
            {list(dash, false)}
          </>
        )}

        <h2 className="agy__h2" id="no-topic-documents">ชุดข้อมูลและข้อกำหนดการวิเคราะห์ที่ยังไม่มีประเด็น ({docs.length})</h2>
        {docs.length === 0 ? (
          <p className="agy__sub">ทุกรายการมีประเด็นแล้ว</p>
        ) : (
          <>
            {isAdmin && (
              <p className="agy__sub">
                แยกตามจังหวัด: {byProvince(docs).map(([p, n]) => `${p} ${n}`).join(' · ')}
              </p>
            )}
            {docs.length > 300 && <p className="agy__sub">แสดง 300 รายการแรกจาก {docs.length}</p>}
            {list(docs, true)}
          </>
        )}
      </div>
    </Shell>
  )
}
