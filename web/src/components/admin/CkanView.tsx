import { sql } from '@payloadcms/db-postgres'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { searchCkan } from '@/lib/ckanSearch'
import { ckanSyncRunning } from '@/lib/ckanSync'
import { dataSearchSettings } from '@/lib/dataSearch'
import { safeHref } from '@/lib/urlRules'

import { CkanSyncButton } from './CkanSyncButton'
import { Shell, type Staff } from './Shell'

const n = (v: number) => v.toLocaleString('th-TH')
const when = (d?: string | null) => (d ? new Date(d).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }) : '—')
const SOURCE: Record<string, string> = { province: 'catalog จังหวัด', statprovince: 'statprovince', gdcatalog: 'gdcatalog.go.th' }
const STATUS: Record<string, string> = { running: 'กำลังดึง', ok: 'สำเร็จ', failed: 'ไม่สำเร็จ' }

/**
 * /admin/ckan-search — central admins: the copy of the provinces' datasets on the CKAN portals,
 * when it was last refreshed, and a search box to check what the province data search finds.
 */
export async function CkanView(props: AdminViewServerProps) {
  const { req } = props.initPageResult
  const user = req.user as Staff | null
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/admin')
  const sp = ((await props.searchParams) ?? {}) as Record<string, string | undefined>
  const payload = req.payload

  const provinces = (await payload.find({ collection: 'provinces', limit: 200, depth: 0, pagination: false, sort: 'nameTh', select: { slug: true, nameTh: true } })).docs
  const counts = (await payload.db.drizzle.execute(sql`select province_id, source, count(*)::int as n from ckan_datasets group by 1, 2`)).rows as { province_id: number; source: string; n: number }[]
  const bySource = (s: string) => counts.filter((c) => c.source === s).reduce((a, c) => a + c.n, 0)
  const perProvince = new Map<number, Record<string, number>>()
  for (const c of counts) perProvince.set(c.province_id, { ...perProvince.get(c.province_id), [c.source]: c.n })
  const missing = provinces.filter((p) => !perProvince.has(p.id))

  const runs = (await payload.find({ collection: 'ckan-sync-runs', sort: '-startedAt', limit: 6, depth: 0 })).docs

  const province = provinces.find((p) => p.slug === sp.province) ?? provinces.find((p) => p.slug === 'kalasin') ?? provinces[0]
  const q = (sp.q ?? '').trim()
  const { synonyms } = dataSearchSettings((await payload.findGlobal({ slug: 'site-settings', depth: 0 })).dataSearch)
  const result = province && sp.q !== undefined ? await searchCkan(payload, { provinceId: province.id, provinceName: province.nameTh, q, limit: 15, synonyms }) : null

  return (
    <Shell {...props} title="ข้อมูลจากพอร์ทัล CKAN">
      <div className="agy">
        <div className="agy__head">
          <div>
            <h1>ข้อมูลจากพอร์ทัล CKAN</h1>
            <p className="agy__sub">
              สำเนารายการชุดข้อมูลของแต่ละจังหวัดจาก catalog ของจังหวัด (&lt;ชื่อจังหวัด&gt;.gdcatalog.go.th) และ statprovince (กลุ่ม &quot;จังหวัด…&quot;) สำหรับช่องค้นหาข้อมูลบนหน้าเว็บจังหวัด ·
              เก็บเฉพาะชื่อ คำอธิบาย และลิงก์ ข้อมูลจริงยังอยู่ที่พอร์ทัล · ระบบดึงใหม่ทุกคืน (ตี 1–5)
            </p>
          </div>
        </div>

        <div className="agy__tiles">
          <div className="agy__tile"><span>ชุดข้อมูลในดัชนี</span><strong>{n(bySource('province') + bySource('statprovince'))}</strong></div>
          <div className="agy__tile"><span>จาก catalog จังหวัด</span><strong>{n(bySource('province'))}</strong></div>
          <div className="agy__tile"><span>จาก statprovince</span><strong>{n(bySource('statprovince'))}</strong></div>
          <div className="agy__tile"><span>จังหวัดที่ยังไม่มีข้อมูล</span><strong>{n(missing.length)}</strong></div>
        </div>

        <div className="agy__card">
          <div className="agy__head" style={{ marginBottom: 0 }}>
            <div>
              <h2>การดึงข้อมูล</h2>
              <p className="agy__sub">การดึงหนึ่งรอบใช้เวลาหลายนาที (เรียก catalog ทีละจังหวัดอย่างช้า ๆ เพื่อไม่ให้รบกวน) · จังหวัดที่อ่านไม่ได้ในรอบนั้นจะคงรายการเดิมไว้</p>
            </div>
            <div className="agy__actions">
              <CkanSyncButton running={ckanSyncRunning()} />
            </div>
          </div>
          {runs.length === 0 ? (
            <p className="agy__sub">ยังไม่เคยดึงข้อมูล</p>
          ) : (
            <table className="agy-ckan__runs">
              <thead>
                <tr><th>พอร์ทัล</th><th>เริ่ม</th><th>เสร็จ</th><th>ผล</th><th>จำนวน</th><th>หมายเหตุ</th></tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td>{SOURCE[r.source] ?? r.source}</td>
                    <td>{when(r.startedAt)}</td>
                    <td>{when(r.finishedAt)}</td>
                    <td className={`agy-ckan__status agy-ckan__status--${r.status}`}>{STATUS[r.status] ?? r.status}</td>
                    <td>{r.fetched != null ? `${n(r.fetched)} รายการ${r.removed ? ` (นำออก ${n(r.removed)})` : ''}` : ''}</td>
                    <td>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {missing.length > 0 && counts.length > 0 && <p className="agy__sub">จังหวัดที่ไม่พบชุดข้อมูลในทั้งสองแหล่ง: {missing.map((p) => p.nameTh).join(', ')}</p>}
        </div>

        <div className="agy__card">
          <div>
            <h2>ทดสอบการค้นหา</h2>
            <p className="agy__sub">ค้นแบบเดียวกับที่จะใช้บนหน้าเว็บจังหวัด (เฉพาะชุดข้อมูลของจังหวัดที่เลือก) · คะแนนและเหตุผลแสดงเฉพาะหน้านี้ เพื่อใช้ปรับการค้นหา</p>
          </div>
          <form method="get" className="agy-ckan__form" role="search">
            <label className="agy__field">
              <span>จังหวัด</span>
              <select name="province" defaultValue={province?.slug}>
                {provinces.map((p) => (
                  <option key={p.id} value={p.slug}>
                    {p.nameTh} ({n((perProvince.get(p.id)?.province ?? 0) + (perProvince.get(p.id)?.statprovince ?? 0))})
                  </option>
                ))}
              </select>
            </label>
            <label className="agy__field agy-ckan__q">
              <span>คำถาม</span>
              <input type="search" name="q" defaultValue={q} placeholder="เช่น ข้อมูลประชากร ปี 2566 / ปริมาณน้ำฝน excel / แผนที่โรงเรียน" maxLength={200} />
            </label>
            <button type="submit" className="agy__btn agy__btn--primary">ค้นหา</button>
          </form>

          {result && (
            <>
              <p className="agy__sub">
                คำที่ใช้ค้น: {result.query.words.length ? result.query.words.join(' · ') : '—'}
                {result.query.year && ` · ปี ${result.query.year}`}
                {result.query.formats.length > 0 && ` · ไฟล์ ${result.query.formats.join('/')}`}
                {result.query.gis && ' · แผนที่'} · พบ {n(result.total)} จาก {n(result.indexed)} ชุดของจังหวัด{province?.nameTh}
              </p>
              {result.hits.length === 0 ? (
                <p className="agy__sub">ไม่พบชุดข้อมูลที่ตรงกับคำถาม</p>
              ) : (
                <ol className="agy-ckan__hits">
                  {result.hits.map((h) => (
                    <li key={h.id}>
                      <div className="agy-ckan__title">
                        {safeHref(h.url) ? (
                          <a href={safeHref(h.url)} target="_blank" rel="noopener noreferrer">
                            {h.title}
                          </a>
                        ) : (
                          h.title
                        )}
                        <span className="agy-ckan__score">{h.score}</span>
                      </div>
                      <div className="agy-ckan__meta">
                        {SOURCE[h.source] ?? h.source} · {h.orgTitle}
                        {h.formats.length > 0 && ` · ${h.formats.join(', ')}`}
                        {h.resources.some((r) => r.datastore) && ' · ดึงตัวเลขได้'}
                        {h.modifiedAt && ` · ปรับปรุง ${when(h.modifiedAt)}`}
                      </div>
                      {h.notes && <p className="agy-ckan__notes">{h.notes.length > 220 ? `${h.notes.slice(0, 220)}…` : h.notes}</p>}
                      <div className="agy-ckan__why">{h.why.join(' · ') || 'ชุดล่าสุด'}</div>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
      </div>
    </Shell>
  )
}
