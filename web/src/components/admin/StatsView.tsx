import { sql } from '@payloadcms/db-postgres'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { bangkokDay } from '@/lib/site'

import { AdminYearPicker } from './AdminYearPicker'
import { Shell, type Staff, staffProvinces } from './Shell'
import { SortTable } from './SortTable'
import { type MapItem, ThaiVisitMap } from './ThaiVisitMap'

const PAGE_LABEL: Record<string, string> = { home: 'หน้าหลัก', docs: 'เอกสาร', utilization: 'สารสนเทศเพื่อการตัดสินใจ', guides: 'แผนงานและคู่มือ' }
const RANGES = [30, 90, 365]
const n = (v: unknown) => Number(v ?? 0).toLocaleString('th-TH')
const shortDay = (iso: string) => new Date(iso + 'T00:00:00+07:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
const longDay = (iso: string) => new Date(iso + 'T00:00:00+07:00').toLocaleDateString('th-TH', { dateStyle: 'long' })
/** Thai fiscal year (พ.ศ.) of a day: 1 October starts the next year, e.g. 2026-10-12 → 2570. */
const fyOf = (iso: string) => {
  const [y, m] = iso.split('-').map(Number)
  return (m >= 10 ? y + 1 : y) + 543
}
/** First and last day (ค.ศ., yyyy-mm-dd) of a fiscal year. */
const fyRange = (fy: number) => ({ start: `${fy - 544}-10-01`, end: `${fy - 543}-09-30` })
const nextDay = (iso: string) => {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * /admin/visit-stats — page views of the public site. Central admins see every province and can
 * narrow to one; province staff see their own. Counts are anonymous daily totals (no IP, no cookie);
 * signed-in staff and known robots are not counted.
 */
export async function StatsView(props: AdminViewServerProps) {
  const { req } = props.initPageResult
  const user = req.user as Staff | null
  if (!user) redirect('/login')
  const isAdmin = user.role === 'admin'
  const sp = (await props.searchParams) ?? {}
  const days = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 30
  const db = req.payload.db.drizzle

  const provinces = await req.payload.find({ collection: 'provinces', limit: 200, depth: 0, pagination: false, sort: 'nameTh', where: isAdmin ? {} : { id: { in: staffProvinces(user) } } })
  const wanted = Number(sp.province)
  const one = isAdmin ? (provinces.docs.find((p) => p.id === wanted) ?? null) : (provinces.docs[0] ?? null)
  if (!isAdmin && !one) redirect('/admin')
  const scope = one ? sql`province_id = ${one.id}` : sql`true`

  const today = bangkokDay()
  const [y, m] = today.split('-').map(Number)
  const fyStart = `${m >= 10 ? y : y - 1}-10-01`
  const from = bangkokDay(new Date(Date.now() - (days - 1) * 86400000))

  // fiscal years that have counts (counting started in October 2569, so the list starts at 2570);
  // ?year= picks some of them, otherwise the page shows the last 30 / 90 / 365 days as before
  const firstDay = String(((await db.execute(sql`select min(day) as d from page_views where ${scope}`)).rows[0] as { d?: string | null })?.d ?? today)
  const years: number[] = []
  for (let fy = fyOf(today); fy >= fyOf(firstDay); fy--) years.push(fy)
  const asked = String(sp.year ?? '').split(',').map(Number).filter((y) => years.includes(y))
  const selected = asked.length ? [...new Set(asked)].sort((a, b) => b - a) : years
  const byYear = asked.length > 0
  const yearText = `ปีงบประมาณ ${[...selected].sort((a, b) => a - b).join(', ')}`
  // the period every chart and table below uses
  const inPeriod = byYear
    ? sql`(${sql.join(selected.map((fy) => sql`(day between ${fyRange(fy).start} and ${fyRange(fy).end})`), sql` or `)})`
    : sql`day >= ${from}`
  const periodText = byYear ? yearText : `${days} วันล่าสุด`

  const totals = (
    await db.execute(sql`
      select coalesce(sum(views) filter (where day = ${today}), 0)::int as today,
             coalesce(sum(views) filter (where day >= ${today.slice(0, 7) + '-01'}), 0)::int as month,
             coalesce(sum(views) filter (where day >= ${fyStart}), 0)::int as fy,
             coalesce(sum(views), 0)::int as total, min(day) as since
      from page_views where ${scope}`)
  ).rows[0] as Record<string, unknown>

  const daily = (await db.execute(sql`select day, sum(views)::int as views from page_views where ${scope} and ${inPeriod} group by day order by day`)).rows as { day: string; views: number }[]
  const byDay = new Map(daily.map((r) => [String(r.day), Number(r.views)]))
  // one bar per day: the chosen fiscal years up to today, or the last N days
  const chartDays: string[] = []
  if (byYear) {
    for (const fy of [...selected].sort((a, b) => a - b)) {
      const { start, end } = fyRange(fy)
      for (let d = start; d <= end && d <= today; d = nextDay(d)) chartDays.push(d)
    }
  } else {
    for (let i = 0; i < days; i++) chartDays.push(bangkokDay(new Date(Date.now() - (days - 1 - i) * 86400000)))
  }
  const series = chartDays.map((day) => ({ day, views: byDay.get(day) ?? 0 }))
  const peak = Math.max(1, ...series.map((s) => s.views))
  const rangeTotal = series.reduce((a, s) => a + s.views, 0)

  const pages = (await db.execute(sql`select page::text as page, sum(views)::int as views from page_views where ${scope} and ${inPeriod} group by page order by views desc`)).rows as { page: string; views: number }[]

  const ranking = one
    ? []
    : ((
        await db.execute(sql`
          select province_id,
                 coalesce(sum(views) filter (where day = ${today}), 0)::int as today,
                 coalesce(sum(views) filter (where ${inPeriod}), 0)::int as range,
                 coalesce(sum(views) filter (where day >= ${fyStart}), 0)::int as fy,
                 sum(views)::int as total,
                 -- every count stamps updated_at, so this is when someone last opened the province's site today
                 floor(extract(epoch from now() - max(updated_at) filter (where day = ${today})) / 60)::int as ago
          from page_views group by province_id`)
      ).rows as { province_id: number; today: number; range: number; fy: number; total: number; ago: number | null }[])
  const rankBy = new Map(ranking.map((r) => [Number(r.province_id), r]))

  // Opens of each file through its public link (counted since this feature was switched on).
  const files = (
    await db.execute(sql`
      select f.id, f.original_name, f.download_count::int as n, min(d.title) as title, min(p.name_th) as province
      from files f
      join documents_rels r on r.files_id = f.id and r.path = 'files'
      join documents d on d.id = r.parent_id and d.deleted_at is null
      join provinces p on p.id = d.province_id
      where f.is_current and coalesce(f.download_count, 0) > 0 and ${one ? sql`d.province_id = ${one.id}` : sql`true`}
      group by f.id order by f.download_count desc limit 15`)
  ).rows as { id: number; original_name: string; n: number; title: string; province: string }[]

  const link = (q: Record<string, string | number | undefined>) => {
    const merged = { days: days === 30 ? undefined : days, year: byYear ? selected.join(',') : undefined, province: one && isAdmin ? one.id : undefined, ...q }
    const qs = Object.entries(merged).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`).join('&')
    return `/admin/visit-stats${qs ? `?${qs}` : ''}`
  }

  // the map: every province, coloured by its views in the period (central admins, all provinces)
  const mapItems: MapItem[] = provinces.docs.map((p) => {
    const r = rankBy.get(p.id)
    return { id: p.id, code: p.code, nameTh: p.nameTh, views: Number(r?.range ?? 0), ago: r?.ago == null ? null : Number(r.ago), href: link({ province: p.id }) }
  })
  const updatedAt = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })

  // bar chart: one bar per day, drawn as plain SVG
  const W = 960, H = 220, pad = 28
  const bw = (W - pad) / series.length
  const ticks = [0, 0.5, 1].map((t) => Math.round(peak * t))
  const labelEvery = Math.ceil(series.length / 10)

  return (
    <Shell {...props} title="สถิติการเข้าชม">
      <div className="agy">
        <div className="agy__head">
          <div>
            <h1>สถิติการเข้าชม{one ? ` จังหวัด${one.nameTh}` : ' ทุกจังหวัด'}</h1>
            <p className="agy__sub">
              จำนวนครั้งที่เปิดหน้าเว็บสาธารณะ ไม่นับเจ้าหน้าที่ที่เข้าสู่ระบบและโปรแกรมอัตโนมัติ ไม่เก็บ IP หรือข้อมูลระบุตัวผู้เข้าชม
              {totals.since ? ` · เริ่มนับ ${longDay(String(totals.since))}` : ''}
            </p>
          </div>
          {isAdmin && one && <Link className="agy__btn" href={link({ province: undefined })}>ดูทุกจังหวัด</Link>}
        </div>

        {years.length > 0 && <AdminYearPicker years={years} selected={selected} all={!byYear} />}

        <div className="agy__tiles">
          <div className="agy__tile"><span>วันนี้</span><strong>{n(totals.today)}</strong></div>
          <div className="agy__tile"><span>เดือนนี้</span><strong>{n(totals.month)}</strong></div>
          <div className="agy__tile"><span>ปีงบประมาณนี้</span><strong>{n(totals.fy)}</strong></div>
          <div className="agy__tile"><span>ทั้งหมด</span><strong>{n(totals.total)}</strong></div>
        </div>

        {!one && (
          <div className="agy__card">
            <div>
              <h2>แผนที่การเข้าชม</h2>
              <p className="agy__sub">สีเข้ม = เข้าชมมากใน {periodText} · จุดสีส้มกระพริบ = มีผู้เปิดหน้าเว็บจังหวัดนั้นในช่วง 15 นาทีล่าสุด · กดที่จังหวัดเพื่อดูรายละเอียด</p>
            </div>
            <ThaiVisitMap items={mapItems} periodText={periodText} updatedAt={updatedAt} />
          </div>
        )}

        <div className="agy__card">
          <div className="agy__head" style={{ marginBottom: 0 }}>
            <div>
              <h2>การเข้าชมรายวัน</h2>
              <p className="agy__sub">{periodText} รวม {n(rangeTotal)} ครั้ง · สูงสุด {n(peak === 1 && rangeTotal === 0 ? 0 : peak)} ครั้งต่อวัน</p>
            </div>
            <div className="agy__actions">
              {RANGES.map((d) => (
                // a day range shows the latest days of every year, so it clears the year choice
                <Link key={d} className={!byYear && d === days ? 'agy__btn agy__btn--primary' : 'agy__btn'} href={link({ days: d === 30 ? undefined : d, year: undefined })}>
                  {d === 365 ? '1 ปี' : `${d} วัน`}
                </Link>
              ))}
            </div>
          </div>
          {rangeTotal === 0 ? (
            <p className="agy__sub">ยังไม่มีการเข้าชมในช่วงนี้</p>
          ) : (
            <svg className="agy-chart" viewBox={`0 0 ${W} ${H + 26}`} role="img" aria-label={`กราฟการเข้าชมรายวัน ${periodText} รวม ${rangeTotal} ครั้ง`}>
              {ticks.map((t, i) => {
                const yy = H - (t / peak) * (H - 12)
                return (
                  <g key={i}>
                    <line x1={pad} x2={W} y1={yy} y2={yy} className="agy-chart__grid" />
                    <text x={pad - 6} y={yy + 4} textAnchor="end" className="agy-chart__tick">{t}</text>
                  </g>
                )
              })}
              {series.map((s, i) => {
                const h = (s.views / peak) * (H - 12)
                return (
                  <g key={s.day}>
                    <rect x={pad + i * bw + bw * 0.12} y={H - h} width={Math.max(1, bw * 0.76)} height={h} rx={Math.min(3, bw / 4)} className="agy-chart__bar">
                      <title>{`${longDay(s.day)}: ${s.views} ครั้ง`}</title>
                    </rect>
                    {i % labelEvery === 0 && (
                      <text x={pad + i * bw + bw / 2} y={H + 18} textAnchor="middle" className="agy-chart__tick">{shortDay(s.day)}</text>
                    )}
                  </g>
                )
              })}
            </svg>
          )}
        </div>

        <div className="agy__card">
          <h2>แยกตามหน้า ({periodText})</h2>
          {pages.length === 0 ? (
            <p className="agy__sub">ยังไม่มีข้อมูล</p>
          ) : (
            <div className="agy-bars">
              {pages.map((p) => (
                <div className="agy-bars__row" key={p.page}>
                  <span>{PAGE_LABEL[p.page] ?? p.page}</span>
                  <span className="agy-bars__track"><i style={{ width: `${(Number(p.views) / Math.max(1, rangeTotal)) * 100}%` }} /></span>
                  <strong>{n(p.views)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        {!one && (
          <>
            <h2 className="agy__h2">รายจังหวัด</h2>
            <div style={{ marginBottom: 24 }}>
              <SortTable
                columns={[
                  { label: 'จังหวัด' },
                  { label: 'วันนี้', className: 'num' },
                  { label: periodText, className: 'num' },
                  { label: 'ปีงบประมาณนี้', className: 'num' },
                  { label: 'ทั้งหมด', className: 'num' },
                  { label: <span className="sr-only">ลิงก์</span>, sortable: false },
                ]}
                initial={{ col: 2, desc: true }}
                rows={provinces.docs.map((p) => {
                  const r = rankBy.get(p.id)
                  const v = [r?.today, r?.range, r?.fy, r?.total].map((x) => Number(x ?? 0))
                  return {
                    key: p.id,
                    sort: [p.nameTh, ...v, null],
                    cellClass: [undefined, ...v.map((x) => (x ? 'num' : 'num zero')), undefined],
                    cells: [<strong key="n">{p.nameTh}</strong>, ...v.map((x) => n(x)), <Link key="l" href={link({ province: p.id })}>ดูรายละเอียด</Link>],
                  }
                })}
              />
            </div>
          </>
        )}

        {/* file opens are kept as running totals, not per day, so this table cannot follow the year choice */}
        <h2 className="agy__h2">ไฟล์เอกสารที่ถูกเปิดมากที่สุด{byYear ? ' (นับรวมทุกปี)' : ''}</h2>
        {files.length === 0 ? (
          <p className="agy__sub">ยังไม่มีข้อมูล ระบบเริ่มนับเมื่อมีผู้เปิดไฟล์จากหน้าเว็บ</p>
        ) : (
          <SortTable
            columns={[{ label: 'เอกสาร' }, ...(!one ? [{ label: 'จังหวัด' }] : []), { label: 'ไฟล์' }, { label: 'จำนวนครั้งที่เปิด', className: 'num' }]}
            rows={files.map((f) => ({
              key: f.id,
              sort: [f.title, ...(!one ? [f.province] : []), f.original_name, Number(f.n)],
              cells: [f.title, ...(!one ? [f.province] : []), <Link key="f" href={`/admin/collections/files/${f.id}`}>{f.original_name}</Link>, n(f.n)],
            }))}
          />
        )}
      </div>
    </Shell>
  )
}
