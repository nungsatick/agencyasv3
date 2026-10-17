import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { PageExtras } from '@/components/PageExtras'
import { CountUp } from '@/components/CountUp'

import { HitStats, TopicTag } from '@/components/Chrome'
import { groupOf, Svg } from '@/components/docGroups'
import { FileIcon } from '@/components/FileIcon'
import { distinctYears, getDashboards, getDocuments, getProvince, fileUrl } from '@/lib/data'
import { getHits } from '@/lib/site'
import { topicColor } from '@/lib/themes'
import type { File as FileDoc } from '@/payload-types'

export default async function ProvinceHome({ params }: { params: Promise<{ province: string }> }) {
  const province = await getProvince((await params).province)
  if (!province) notFound()
  const [docs, dashboards] = await Promise.all([getDocuments(province.id), getDashboards(province.id)])
  const base = `/${province.slug}`

  const years = distinctYears([...docs, ...dashboards])
  const latest = years[0]
  const meetingsThisYear = new Set(
    docs.filter((d) => d.fiscalYear === latest && d.type.group === 'meeting' && d.meetingNo).map((d) => d.meetingNo),
  ).size
  // Four cards fill one row on a desktop screen: pinned ones first, then the newest of any year.
  // (getDashboards is already newest year first, then the province's own order.)
  const featured = [...dashboards.filter((d) => d.pinned), ...dashboards.filter((d) => !d.pinned)].slice(0, 4)
  const NEW_DAYS = 30
  const addedHere = (d: (typeof docs)[number]) => !d.legacyId // imported ones carry their old-site id; their date is the import's
  // the five latest: documents added here first (newest first), then the imported ones, newest year first
  const recentDocs = [...docs.filter(addedHere).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), ...docs.filter((d) => !addedHere(d))].slice(0, 5)
  const isNew = (d: (typeof docs)[number]) => addedHere(d) && Date.now() - new Date(d.createdAt).getTime() < NEW_DAYS * 86400000
  const shortDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' }) : ''
  const recentFiles = recentDocs.flatMap((d) => d.files.map((f) => f.id))
  const [fileViews, fileDownloads, linkOpens] = await Promise.all([
    getHits('file_view', recentFiles),
    getHits('file_download', recentFiles),
    getHits('doc_link', recentDocs.filter((d) => d.externalUrl).map((d) => d.id)),
  ])
  const sumHits = (m: Map<number, number>, d: (typeof docs)[number]) => d.files.reduce((a, f) => a + (m.get(f.id) ?? 0), 0)

  const hero = typeof province.heroImage === 'object' ? (province.heroImage as FileDoc | null) : null
  const heroUrl = hero?.url ?? null
  const side = province.heroTextSide === 'right' ? 'right' : 'left'
  const heroStyle = heroUrl
    ? {
        backgroundImage: `linear-gradient(${side === 'left' ? '90deg' : '270deg'}, color-mix(in srgb, var(--deep) 94%, transparent) 0%, color-mix(in srgb, var(--deep) 80%, transparent) 40%, color-mix(in srgb, var(--deep) 15%, transparent) 75%, transparent 100%), url(${heroUrl})`,
        // keep the chosen point of the picture in view however the header is cropped
        backgroundPosition: `center, ${province.heroFocusX ?? 50}% ${province.heroFocusY ?? 40}%`,
      }
    : undefined

  return (
    <>
      <PageExtras province={province} page="home" />

      <section className={`hero hero--${side}${heroUrl ? ' hero--image' : ''}`} style={heroStyle}>
        {heroUrl && <span className="hero__light" aria-hidden="true" />}
        <div className="wrap hero__in">
          <div className="hero__text">
            {latest && <div className="hero__eyebrow">ปีงบประมาณ {latest}</div>}
            <h1>บัญชีข้อมูลจังหวัด{province.nameTh}</h1>
            <p>บูรณาการและแบ่งปันชุดข้อมูลของหน่วยงานในจังหวัด เพื่อใช้วางแผนและตัดสินใจเชิงพื้นที่</p>
            <div className="hero__actions">
              <a href={province.ckanUrl} target="_blank" rel="noopener noreferrer" className="btn btn--light btn--lg">
                ค้นหาชุดข้อมูลในระบบบัญชีข้อมูล
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17L17 7" />
                  <path d="M8 7h9v9" />
                </svg>
              </a>
              <Link href={`${base}/utilization`} className="btn btn--ghost btn--lg">
                ดูแดชบอร์ดจังหวัด
              </Link>
            </div>
          </div>
          {!heroUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="hero__seal" src={`/logos/${province.code}.png`} alt="" width={220} height={220} />
          )}
        </div>
      </section>

      <main className="wrap page page--home">
        <section className="stats" aria-label="สถิติข้อมูลจังหวัด">
          <div className="stat">
            <div className="stat__num"><CountUp value={dashboards.length} /></div>
            <span className="stat__icon"><Svg size={30}><path d="M4 20V14M10 20v-8M16 20v-5M22 20V8M3 10l6-5 7 4 5-6M17 3h4v4" /></Svg></span>
            <div className="stat__label">แดชบอร์ด</div>
          </div>
          <div className="stat">
            <div className="stat__num"><CountUp value={docs.length} /></div>
            <span className="stat__icon"><Svg size={30}><path d="M6 3h8l5 5v13H6ZM14 3v5h5M9 12h7M9 16h7" /></Svg></span>
            <div className="stat__label">เอกสาร</div>
          </div>
          <div className="stat">
            <div className="stat__num"><CountUp value={meetingsThisYear} /></div>
            <span className="stat__icon"><Svg size={30}><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 19a5.5 5.5 0 0 1 11 0M16 5.3a3 3 0 0 1 0 5.4M17.5 14a5.5 5.5 0 0 1 4 5" /></Svg></span>
            <div className="stat__label">ครั้งที่ประชุมคณะกรรมการ</div>
            <div className="stat__detail">ปีงบประมาณ {latest ?? '-'}</div>
          </div>
          <div className="stat">
            <div className="stat__num"><CountUp value={years.length} /> <span className="stat__unit">ปี</span></div>
            <span className="stat__icon"><Svg size={30}><path d="M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2ZM7 2v6M17 2v6M3 10h18M7 14h2M13 14h2M7 17h2M13 17h2" /></Svg></span>
            <div className="stat__label">ข้อมูลย้อนหลัง</div>
            <div className="stat__detail">{years.length ? `พ.ศ. ${years[years.length - 1]}–${years[0]}` : 'ยังไม่มีข้อมูล'}</div>
          </div>
        </section>

        {featured.length > 0 && (
          <section className="block">
            <div className="block__head">
              <h2>สารสนเทศเพื่อการตัดสินใจ</h2>
              <Link href={`${base}/utilization?year=all`} className="link-strong">
                ดูทั้งหมด {dashboards.length} รายการ
              </Link>
            </div>
            <div className="grid-cards">
              {featured.map((d) => {
                const c = topicColor(d.topic)
                return (
                  <Link key={d.id} href={`${base}/utilization?year=${d.fiscalYear}#d-${d.id}`} className="dash-card" style={{ '--card-tone': c.dot } as React.CSSProperties}>
                    {d.thumbnail && typeof d.thumbnail === 'object' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="dash-card__thumb dash-card__thumb--img" src={`${fileUrl(d.thumbnail as FileDoc)}?cover=1`} alt="" loading="lazy" />
                    ) : (
                      <span className="dash-card__thumb" style={{ background: c.bg, color: c.text }} aria-hidden="true">
                        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                          <path d="M4 20V10" />
                          <path d="M10 20V4" />
                          <path d="M16 20v-7" />
                          <path d="M22 20H2" />
                        </svg>
                      </span>
                    )}
                    <span className="dash-card__body">
                      <span className="dash-card__meta">
                        <TopicTag topic={d.topic} />
                        <span className="dash-card__year">ปี {d.fiscalYear}</span>
                      </span>
                        {d.pinned && (
                          <span className="pin-tag">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3Z" />
                            </svg>
                            ปักหมุด
                          </span>
                        )}
                      <span className="dash-card__title">{d.title}</span>
                      <span className="dash-card__footer"><span className="dash-card__state">ดูสารสนเทศ</span></span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {recentDocs.length > 0 && (
          <section className="block">
            <div className="block__head">
              <h2>เอกสารล่าสุด</h2>
              <Link href={`${base}/docs`} className="link-strong">
                ดูเอกสารทั้งหมด
              </Link>
            </div>
            <div className="card dtable-wrap">
              <table className="dtable">
                <thead>
                  <tr>
                    <th scope="col">เอกสาร</th>
                    <th scope="col" className="dtable__year">ปีงบประมาณ</th>
                    <th scope="col" className="dtable__filecol">การใช้งาน</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDocs.map((d) => {
                    const g = groupOf(d.type.group)
                    const f = d.files[0]
                    return (
                      <tr key={d.id} className={`tone-${g.tone}`}>
                        <td className="dtable__doc">
                          <div className="dtable__entry">
                            {f ? (
                              <a className="dtable__attachment" href={fileUrl(f)} target="_blank" rel="noopener noreferrer" aria-label={`เปิดไฟล์ ${d.title}`} title="เปิด / ดาวน์โหลดไฟล์">
                                <FileIcon file={f} size={36} />
                              </a>
                            ) : (
                              <span className="dtable__attachment" aria-hidden="true"><Svg size={28}>{g.icon}</Svg></span>
                            )}
                          <div className="dtable__text">
                          <Link href={`${base}/docs?year=${d.fiscalYear}#${f ? 'preview' : 'item'}-${d.legacyId ?? d.id}`} className="dtable__title">
                            {d.title}
                          </Link>
                            <span className="dtable__meta">
                              <span className="dtable__category">{d.type.nameTh.replace(/คณะกรรมการระดับจังหวัด|ระดับจังหวัด|ระดับพื้นที่/g, '').trim()}</span>
                              {isNew(d) && <span className="new-tag">ใหม่</span>}
                              {d.topic && <TopicTag topic={d.topic} />}
                              {d.meetingDate && <span>ประชุมวันที่ {shortDate(d.meetingDate)}</span>}
                            </span>
                          </div>
                          </div>
                        </td>
                        <td className="dtable__year">
                          <span className="year-tag"><span className="sr-only">ปีงบประมาณ </span>{d.fiscalYear}</span>
                        </td>
                        <td className="dtable__filecol">
                          <span className="dtable__file">
                            <HitStats views={sumHits(fileViews, d) + (linkOpens.get(d.id) ?? 0)} downloads={d.files.length ? sumHits(fileDownloads, d) : undefined} />
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </>
  )
}
