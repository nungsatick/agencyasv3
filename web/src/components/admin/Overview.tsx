import Link from 'next/link'
import { sql } from '@payloadcms/db-postgres'
import type { ServerProps } from 'payload'
import React from 'react'

import { INACTIVE_WARN_DAYS } from '@/lib/maintenance'

import { AdminYearPicker } from './AdminYearPicker'
import { SortTable } from './SortTable'

type AnyUser = { id: number; name?: string; role?: string; provinces?: (number | { id: number })[] } | null | undefined
type Counts = { docs: number; dash: number; review: number; drafts: number }

const zero = (): Counts => ({ docs: 0, dash: 0, review: 0, drafts: 0 })

/**
 * Landing screen after sign-in. Central admins get every province in one table (plain counts,
 * no pass/fail judgement); province staff get their own province's numbers and shortcuts.
 */
export async function Overview({ payload, user, searchParams }: ServerProps) {
  const u = user as AnyUser
  if (!u) return null
  const mine = (u.provinces ?? []).map((p) => (typeof p === 'object' ? p.id : p))
  const isAdmin = u.role === 'admin'

  const provinces = await payload.find({ collection: 'provinces', limit: 200, depth: 0, pagination: false, sort: 'nameTh', where: isAdmin ? {} : { id: { in: mine } } })

  // Counted in SQL: loading every document through the API just to count them took over a minute.
  const scopeSql = isAdmin ? sql`true` : sql`province_id in (${sql.join(mine.length ? mine.map((id) => sql`${id}`) : [sql`-1`], sql`, `)})`
  // the years that have anything, newest first; ?year= picks some of them ("ทั้งหมด" when absent)
  const yearRows = await payload.db.drizzle.execute(sql`
    select distinct fiscal_year as y from (
      select fiscal_year from documents where deleted_at is null and fiscal_year is not null and ${scopeSql}
      union select fiscal_year from dashboards where deleted_at is null and fiscal_year is not null and ${scopeSql}) t
    order by 1 desc`)
  const years = (yearRows.rows as { y: number | string }[]).map((r) => Number(r.y))
  const asked = String(searchParams?.year ?? '')
    .split(',')
    .map(Number)
    .filter((y) => years.includes(y))
  const selected = asked.length ? [...new Set(asked)].sort((a, b) => b - a) : years
  const allYears = selected.length === years.length
  const yearText = allYears ? 'ทุกปี' : `ปี ${selected.join(', ')}`
  const inYears = sql`fiscal_year in (${sql.join(selected.length ? selected.map((y) => sql`${y}`) : [sql`-1`], sql`, `)})`
  const rows = await payload.db.drizzle.execute(sql`
    select province_id,
           sum(docs)::int as docs, sum(dash)::int as dash, sum(drafts)::int as drafts, sum(review)::int as review
    from (
      select province_id,
             count(*) filter (where _status = 'published' and ${inYears}) as docs, 0 as dash,
             count(*) filter (where _status <> 'published' and ${inYears}) as drafts,
             count(*) filter (where needs_review) as review
      from documents where deleted_at is null and ${scopeSql} group by province_id
      union all
      select province_id, 0, count(*) filter (where _status = 'published' and ${inYears}), 0,
             count(*) filter (where needs_review)
      from dashboards where deleted_at is null and ${scopeSql} group by province_id
    ) t group by province_id`)
  const by = new Map<number, Counts>()
  const at = (id: number) => by.get(id) ?? by.set(id, zero()).get(id)!
  for (const r of rows.rows as { province_id: number; docs: number; dash: number; drafts: number; review: number }[]) {
    by.set(Number(r.province_id), { docs: Number(r.docs), dash: Number(r.dash), drafts: Number(r.drafts), review: Number(r.review) })
  }
  const total = [...by.values()].reduce((a, c) => ({ docs: a.docs + c.docs, dash: a.dash + c.dash, review: a.review + c.review, drafts: a.drafts + c.drafts }), zero())
  const docsLink = (provinceId: number, extra = '') => `/admin/documents?province=${provinceId}${extra}`

  // people to look after (central admins, and province managers for their own province):
  // accounts that will be suspended within 90 days, and account requests still waiting
  const managesPeople = isAdmin || u.role === 'province_manager'
  const warnFrom = new Date(Date.now() - INACTIVE_WARN_DAYS * 86_400_000).toISOString()
  const [nearSuspension, waitingRequests] = managesPeople
    ? await Promise.all([
        payload.count({
          collection: 'users',
          overrideAccess: true,
          where: {
            and: [
              { status: { equals: 'active' } },
              { role: { not_equals: 'admin' } },
              { or: [{ lastLoginAt: { less_than: warnFrom } }, { and: [{ lastLoginAt: { exists: false } }, { passwordSetAt: { less_than: warnFrom } }] }] },
              ...(isAdmin ? [] : [{ provinces: { in: mine } }]),
            ],
          },
        }),
        payload.count({ collection: 'account-requests', overrideAccess: true, where: { and: [{ status: { equals: 'pending' } }, ...(isAdmin ? [] : [{ province: { in: mine } }])] } }),
      ]).then(([a, b]) => [a.totalDocs, b.totalDocs])
    : [0, 0]
  const peopleTiles = managesPeople ? (
    <>
      <Link className={nearSuspension ? 'agy__tile agy__tile--warn' : 'agy__tile'} href="/admin/users?idle=1">
        <span>บัญชีใกล้ถูกระงับ (ไม่ได้ใช้งานเกิน {INACTIVE_WARN_DAYS} วัน)</span>
        <strong>{nearSuspension}</strong>
      </Link>
      <Link className={waitingRequests ? 'agy__tile agy__tile--warn' : 'agy__tile'} href="/admin/account-requests">
        <span>คำขอบัญชีรอพิจารณา</span>
        <strong>{waitingRequests}</strong>
      </Link>
    </>
  ) : null

  if (!isAdmin) {
    const p = provinces.docs[0]
    const c = p ? at(p.id) : zero()
    return (
      <div className="agy">
        <div className="agy__head">
          <div>
            <h1>ภาพรวม{p ? `จังหวัด${p.nameTh}` : ''}</h1>
            <p className="agy__sub">จำนวนเอกสารและแดชบอร์ดของจังหวัด {yearText}</p>
          </div>
          {p && (
            <a className="agy__btn" href={`/${p.slug}`} target="_blank" rel="noopener noreferrer">
              ดูหน้าเว็บจังหวัด
            </a>
          )}
        </div>
        {years.length > 0 && <AdminYearPicker years={years} selected={selected} />}
        <div className="agy__tiles">
          <div className="agy__tile"><span>เอกสารที่เผยแพร่ {yearText}</span><strong>{c.docs}</strong></div>
          <div className="agy__tile"><span>แดชบอร์ด {yearText}</span><strong>{c.dash}</strong></div>
          <div className="agy__tile"><span>ร่างที่ยังไม่เผยแพร่ {yearText}</span><strong>{c.drafts}</strong></div>
          <Link className={c.review ? 'agy__tile agy__tile--warn' : 'agy__tile'} href="/admin/review">
            <span>รายการรอตรวจ (ทุกปี)</span><strong>{c.review}</strong>
          </Link>
          {peopleTiles}
        </div>
        <div className="agy__card">
          <h2>ทำงานต่อ</h2>
          <div className="agy__actions">
            <Link className="agy__btn agy__btn--primary" href="/admin/collections/documents/create">เพิ่มเอกสาร</Link>
            <Link className="agy__btn" href="/admin/collections/dashboards/create">เพิ่มแดชบอร์ด</Link>
            <Link className="agy__btn" href="/admin/collections/documents">เอกสารทั้งหมด</Link>
            <Link className="agy__btn" href="/admin/visit-stats">สถิติการเข้าชม</Link>
            <a className="agy__btn" href="/api/overview-export">ส่งออกเป็น Excel</a>
            {p && <Link className="agy__btn" href={`/admin/collections/provinces/${p.id}`}>ปรับแต่งหน้าเว็บและข้อมูลสำนักงาน</Link>}
          </div>
        </div>
      </div>
    )
  }

  const users = await payload.find({ collection: 'users', limit: 100000, depth: 0, pagination: false, select: { status: true, role: true, provinces: true } })
  const managed = new Set(users.docs.filter((x) => x.role === 'province_manager' && x.status !== 'suspended').flatMap((x) => (x.provinces ?? []) as number[]))
  const withDocs = provinces.docs.filter((p) => at(p.id).docs > 0).length
  const withDash = provinces.docs.filter((p) => at(p.id).dash > 0).length

  return (
    <div className="agy">
      <div className="agy__head">
        <div>
          <h1>ภาพรวม {provinces.docs.length} จังหวัด</h1>
          <p className="agy__sub">จำนวนเอกสารและแดชบอร์ดที่แต่ละจังหวัดเผยแพร่ไว้ {yearText}</p>
        </div>
        <div className="agy__actions">
          {/* a file download, so a plain link rather than client navigation */}
          <a className="agy__btn" href="/api/overview-export">ส่งออกเป็น Excel</a>
          <Link className="agy__btn" href="/admin/visit-stats">สถิติการเข้าชม</Link>
          <Link className="agy__btn agy__btn--primary" href="/admin/user-tools">เพิ่มและนำเข้าผู้ใช้</Link>
        </div>
      </div>
      {years.length > 0 && <AdminYearPicker years={years} selected={selected} />}
      <div className="agy__tiles">
        <div className="agy__tile"><span>จังหวัดที่มีเอกสาร {yearText}</span><strong>{withDocs}</strong></div>
        <div className="agy__tile"><span>จังหวัดที่มีแดชบอร์ด {yearText}</span><strong>{withDash}</strong></div>
        <div className="agy__tile"><span>เอกสาร {yearText}</span><strong>{total.docs}</strong></div>
        <div className="agy__tile"><span>แดชบอร์ด {yearText}</span><strong>{total.dash}</strong></div>
        <Link className="agy__tile agy__tile--warn" href="/admin/review">
          <span>รายการรอตรวจทั้งระบบ (ทุกปี)</span><strong>{total.review}</strong>
        </Link>
        <div className={managed.size < provinces.docs.length ? 'agy__tile agy__tile--warn' : 'agy__tile'}>
          <span>จังหวัดที่ยังไม่มีผู้ดูแล</span><strong>{provinces.docs.length - managed.size}</strong>
        </div>
        {peopleTiles}
      </div>
      <SortTable
        columns={[
          { label: 'จังหวัด' },
          { label: `เอกสาร ${allYears ? '' : yearText}`.trim(), className: 'num' },
          { label: `แดชบอร์ด ${allYears ? '' : yearText}`.trim(), className: 'num' },
          { label: 'ร่าง', className: 'num' },
          { label: 'รอตรวจ', className: 'num' },
          { label: 'ผู้ดูแลจังหวัด' },
          { label: <span className="sr-only">ลิงก์</span>, sortable: false },
        ]}
        rows={provinces.docs.map((p) => {
          const c = at(p.id)
          const zero = (v: number) => (v ? 'num' : 'num zero')
          return {
            key: p.id,
            sort: [p.nameTh, c.docs, c.dash, c.drafts, c.review, managed.has(p.id) ? 1 : 0, null],
            cellClass: [undefined, zero(c.docs), zero(c.dash), zero(c.drafts), zero(c.review), undefined, undefined],
            cells: [
              <strong key="n">{p.nameTh}</strong>,
              c.docs,
              c.dash,
              c.drafts,
              c.review,
              managed.has(p.id) ? 'มีแล้ว' : <span style={{ color: '#8a3a08', fontWeight: 600 }}>ยังไม่มี</span>,
              <span key="l" style={{ whiteSpace: 'nowrap' }}>
                <Link href={docsLink(p.id)}>เอกสาร</Link>
                {' · '}
                <a href={`/${p.slug}`} target="_blank" rel="noopener noreferrer">หน้าเว็บ</a>
              </span>,
            ],
          }
        })}
      />
    </div>
  )
}
