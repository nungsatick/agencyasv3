import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { PageExtras } from '@/components/PageExtras'

import { HitStats, SiteHeader } from '@/components/Chrome'
import { GROUPS, Svg } from '@/components/docGroups'
import { FileIcon } from '@/components/FileIcon'
import { FilePreview, StepFile } from '@/components/Interactive'
import { DocSearch, TrackedLink, YearPicker } from '@/components/Tools'
import { type DocRow, distinctYears, fileKind, fileUrl, getDashboards, getDocuments, getProvince, selectYears } from '@/lib/data'
import { getHits } from '@/lib/site'
import { topicColor } from '@/lib/themes'

type Hits = { views: number; downloads?: number }

const thaiDate = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { dateStyle: 'long', timeZone: 'Asia/Bangkok' })
const squash = (s: string) => s.replace(/\s+/g, '')

// what the search box matches against: title, description, issue, topic, type and meeting number
const searchText = (d: DocRow) =>
  [d.title, d.description, d.issueTitle, d.topic?.nameTh, d.type.nameTh, d.meetingNo ? `ครั้งที่ ${d.meetingNo}/${d.fiscalYear}` : '']
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

/** Coloured badge that says what a row opens: PDF, Excel, picture or an outside link. */
function KindBadge({ doc }: { doc: DocRow }) {
  // a file: the picture of its type (PDF, XLSX, JPG ...); otherwise the link / no-file badge
  if (doc.files[0]) return <FileIcon file={doc.files[0]} size={44} />
  const kind = doc.files[0] ? fileKind(doc.files[0]) : doc.externalUrl ? 'ลิงก์' : 'ไม่มีไฟล์'
  const cls = kind === 'PDF' ? 'pdf' : kind === 'Excel' ? 'xls' : kind === 'รูปภาพ' ? 'img' : kind === 'ลิงก์' ? 'link' : 'none'
  return (
    <span className={`kind kind--${cls}`}>
      <Svg size={20}>
        {cls === 'link' ? (
          <path d="M10 13.500a4.500 4.500 0 0 0 6.400 0l3-3a4.500 4.500 0 0 0-6.400-6.400l-1.200 1.200M14 10.500a4.500 4.500 0 0 0-6.400 0l-3 3a4.500 4.500 0 0 0 6.400 6.400l1.200-1.200" />
        ) : cls === 'img' ? (
          <path d="M4 5h16v14H4ZM4 16l4.500-4.500 3.500 3.500 3-3 5 5M9 9.500a1 1 0 1 0 0-.010" />
        ) : cls === 'xls' ? (
          <path d="M7 3h7l5 5v13H7ZM14 3v5h5M10 12l4 5M14 12l-4 5" />
        ) : (
          <path d="M7 3h7l5 5v13H7ZM14 3v5h5M10 13h6M10 17h6" />
        )}
      </Svg>
      <span className="kind__label">{kind}</span>
    </span>
  )
}

function Actions({ doc }: { doc: DocRow }) {
  const f = doc.files[0]
  if (f) return <FilePreview url={fileUrl(f)} kind={fileKind(f)} name={doc.title} itemId={String(doc.legacyId ?? doc.id)} />
  if (doc.externalUrl)
    return (
      <TrackedLink id={doc.id} href={doc.externalUrl}>
        เปิดลิงก์
      </TrackedLink>
    )
  return null
}

function Row({ doc, hits, tag, showYear }: { doc: DocRow; hits: Hits; tag?: React.ReactNode; showYear?: boolean }) {
  // old entries often repeat the title as the description: show it only when it adds something
  const desc = doc.description && squash(doc.description) !== squash(doc.title) ? doc.description : null
  return (
    <div className="doc" id={`item-${doc.legacyId ?? doc.id}`} data-search={searchText(doc)}>
      <KindBadge doc={doc} />
      <div className="doc__main">
        {(tag || showYear) && (
          <span className="doc__tags">
            {showYear && <span className="year-tag">ปี {doc.fiscalYear}</span>}
            {tag}
          </span>
        )}
        <div className="doc__title">{doc.title}</div>
        {desc && <div className="doc__desc">{desc}</div>}
        <HitStats {...hits} />
      </div>
      <div className="doc__actions">
        <Actions doc={doc} />
        {doc.files.slice(1).map((f) => (
          <a key={f.id} href={fileUrl(f)} className="link-strong" target="_blank" rel="noopener noreferrer">
            <FileIcon file={f} size={22} />
            ไฟล์เพิ่มเติม
          </a>
        ))}
      </div>
    </div>
  )
}

export default async function DocsPage({ params, searchParams }: { params: Promise<{ province: string }>; searchParams: Promise<{ year?: string }> }) {
  const province = await getProvince((await params).province)
  if (!province) notFound()
  const sp = await searchParams
  const all = await getDocuments(province.id)
  const years = distinctYears(all)
  const { selected, multi } = selectYears(sp.year, years)
  const yearLabel = selected.length === years.length && multi ? 'ทุกปี' : `ปี ${selected.join(', ')}`
  const ofYear = all.filter((d) => selected.includes(d.fiscalYear))
  const present = GROUPS.filter((g) => ofYear.some((d) => d.type.group === g.key))
  const base = `/${province.slug}/docs`

  // Views = in-page previews of the files plus opens of the external link; downloads = files fetched.
  const fileIds = ofYear.flatMap((d) => d.files.map((f) => f.id))
  const [fileViews, fileDownloads, linkOpens, dashboards] = await Promise.all([
    getHits('file_view', fileIds),
    getHits('file_download', fileIds),
    getHits('doc_link', ofYear.filter((d) => d.externalUrl).map((d) => d.id)),
    getDashboards(province.id),
  ])
  const sum = (m: Map<number, number>, d: DocRow) => d.files.reduce((a, f) => a + (m.get(f.id) ?? 0), 0)
  const hitsOf = (d: DocRow): Hits => ({
    views: sum(fileViews, d) + (linkOpens.get(d.id) ?? 0),
    downloads: d.files.length ? sum(fileDownloads, d) : undefined,
  })
  // year+topic pairs that have a dashboard, for the "see the dashboard" link on dataset cards
  const dashTopics = new Set(dashboards.filter((d) => d.topic).map((d) => `${d.fiscalYear}:${d.topic!.slug}`))

  return (
    <>
      <SiteHeader province={province} active="docs" />
      <PageExtras province={province} page="docs" />
      <main className="wrap page">
        <h1 className="page__title">เอกสารการดำเนินงาน</h1>
        <p className="muted">รายงานการประชุม คำสั่ง ชุดข้อมูล และข้อกำหนดการวิเคราะห์ ของจังหวัด{province.nameTh}</p>

        {years.length === 0 ? (
          <div className="card empty">ยังไม่มีเอกสาร</div>
        ) : (
          <>
            {/* years on the left, search on the right; they stack on a narrow screen */}
            <div className="filters filters--bar">
              <YearPicker years={years} selected={selected} base={base} />
              <DocSearch total={ofYear.length} />
            </div>

            {/* what this year holds, at a glance; each card jumps to its section */}
            <nav className="jump" aria-label={`หมวดเอกสาร${yearLabel}`}>
              {present.map((g) => (
                <a key={g.key} href={`#sec-${g.key}`} className={`jump__card tone-${g.tone}`}>
                  <span className="sec-icon">
                    <Svg>{g.icon}</Svg>
                  </span>
                  <span className="jump__text">
                    <span className="jump__name">{g.short}</span>
                    <span className="jump__count">{ofYear.filter((d) => d.type.group === g.key).length} รายการ</span>
                  </span>
                </a>
              ))}
            </nav>

            {present.map((g) => {
              const rows = ofYear.filter((d) => d.type.group === g.key)
              const head = (
                <div className="sec__head">
                  <span className="sec-icon">
                    <Svg>{g.icon}</Svg>
                  </span>
                  <h2>{g.title}</h2>
                  <span className="sec__count">{rows.length} รายการ</span>
                </div>
              )

              if (g.key === 'meeting') {
                // one card per meeting: its agenda, minutes and supporting papers together
                const byNo = new Map<string, DocRow[]>()
                for (const d of rows) {
                  const k = `${d.fiscalYear}:${d.meetingNo ?? 0}`
                  byNo.set(k, [...(byNo.get(k) ?? []), d])
                }
                const meetings = [...byNo.entries()]
                  .map(([k, items]) => ({ key: k, year: Number(k.split(':')[0]), no: Number(k.split(':')[1]), items }))
                  .sort((a, b) => b.year - a.year || (a.no || 999) - (b.no || 999))
                return (
                  <section className={`sec tone-${g.tone}`} key={g.key} id={`sec-${g.key}`} data-search-group>
                    {head}
                    {meetings.map(({ key, year, no, items }) => {
                      const date = items.find((i) => i.meetingDate)?.meetingDate
                      return (
                        <div className="card meeting" key={key} data-search-group>
                          <div className="meeting__head">
                            <span className="meeting__no">{no ? `ครั้งที่ ${no}/${year}` : `ไม่ระบุครั้งที่${multi ? ` (ปี ${year})` : ''}`}</span>
                            {date && <span className="meeting__date">ประชุมวันที่ {thaiDate(date)}</span>}
                            <span className="meeting__count">{items.length} เอกสาร</span>
                          </div>
                          {[...items]
                            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                            .map((d) => (
                              <Row key={d.id} doc={d} hits={hitsOf(d)} />
                            ))}
                        </div>
                      )
                    })}
                  </section>
                )
              }

              if (g.key === 'dataset') {
                // Template 1 → 2 → 3 of one development issue belong together
                const issues = new Map<string, DocRow[]>()
                for (const d of rows) {
                  const k = `${d.fiscalYear}:${d.issueTitle ?? ''}`
                  issues.set(k, [...(issues.get(k) ?? []), d])
                }
                return (
                  <section className={`sec tone-${g.tone}`} key={g.key} id={`sec-${g.key}`} data-search-group>
                    {head}
                    <div className="grid-issues">
                      {[...issues.entries()].map(([key, items]) => {
                        const year = Number(key.split(':')[0])
                        const issue = key.slice(key.indexOf(':') + 1)
                        const topic = items.find((i) => i.topic)?.topic ?? null
                        const c = topicColor(topic)
                        const ordered = [...items].sort((a, b) => a.type.code.localeCompare(b.type.code))
                        return (
                          <div className="card issue" key={key} data-search-group style={{ '--topic': c.dot, '--topic-text': c.text, '--topic-bg': c.bg } as React.CSSProperties}>
                            <div>
                              {multi && <span className="year-tag">ปี {year}</span>}
                              {topic && <span className="issue__topic">{topic.nameTh}</span>}
                              <div className="issue__title">{issue || 'ชุดข้อมูล'}</div>
                            </div>
                            <ol className="steps">
                              {ordered.map((d) => {
                                const n = /template(\d)/.exec(d.type.code)?.[1]
                                const f = d.files[0]
                                return (
                                  <li className="step" key={d.id} id={`item-${d.legacyId ?? d.id}`} data-search={searchText(d)}>
                                    <span className="step__no">{n ?? '•'}</span>
                                    <span className="step__main">
                                      <span className="step__name">{d.type.nameTh}</span>
                                      <HitStats {...hitsOf(d)} />
                                    </span>
                                    {f ? (
                                      <StepFile url={fileUrl(f)} kind={fileKind(f)} name={d.title} itemId={String(d.legacyId ?? d.id)}>
                                        <a href={fileUrl(f)} target="_blank" rel="noopener noreferrer" className="step__open">
                                          <FileIcon file={f} size={22} withLabel />
                                        </a>
                                      </StepFile>
                                    ) : d.externalUrl ? (
                                      <TrackedLink id={d.id} href={d.externalUrl}>
                                        เปิดลิงก์
                                      </TrackedLink>
                                    ) : null}
                                  </li>
                                )
                              })}
                            </ol>
                            {topic && dashTopics.has(`${year}:${topic.slug}`) && (
                              <Link href={`/${province.slug}/utilization?year=${year}&topic=${topic.slug}`} className="issue__more">
                                ดูแดชบอร์ดประเด็นนี้
                                <Svg size={18}>
                                  <path d="M5 12h14M13 6l6 6-6 6" />
                                </Svg>
                              </Link>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )
              }

              return (
                <section className={`sec tone-${g.tone}`} key={g.key} id={`sec-${g.key}`} data-search-group>
                  {head}
                  <div className="card docs-list">
                    {rows.map((d) => {
                      const c = d.topic ? topicColor(d.topic) : null
                      return (
                        <Row
                          key={d.id}
                          doc={d}
                          hits={hitsOf(d)}
                          showYear={multi}
                          tag={
                            g.key === 'analysis' && d.topic && c ? (
                              <span className="doc__tag doc__tag--topic" style={{ '--topic': c.dot, '--topic-text': c.text, '--topic-bg': c.bg } as React.CSSProperties}>
                                {d.topic.nameTh}
                              </span>
                            ) : undefined
                          }
                        />
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </>
        )}
      </main>
    </>
  )
}
