import config from '@payload-config'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'


import { PageExtras } from '@/components/PageExtras'
import { GuideNav } from '@/components/GuideNav'
import { Svg } from '@/components/docGroups'
import { HitStats } from '@/components/Chrome'
import { TrackedLink, YearPicker } from '@/components/Tools'
import { FileIcon } from '@/components/FileIcon'
import { fileUrl, getProvince, selectYears } from '@/lib/data'
import { getHits } from '@/lib/site'
import type { CentralContent, File as FileDoc } from '@/payload-types'

const isFile = (f: unknown): f is FileDoc => typeof f === 'object' && f !== null

/** Every file a topic offers: its own files and the files in its list. */
const topicFiles = (item: CentralContent) => [...(item.files ?? []).filter(isFile), ...(item.links ?? []).map((l) => l.file).filter(isFile)]

type Hits = { linkOpens: Map<number, number>; downloads: Map<number, number> }

function Item({ item, year, hits }: { item: CentralContent; year?: number | null; hits: Hits }) {
  const files = (item.files ?? []).filter(isFile)
  const all = topicFiles(item)
  const hasLinks = (item.links ?? []).some((l) => !isFile(l.file) && l.url)
  return (
    // its own anchor for the contents menu (two topics can share a slug); the slug stays as an anchor for old links
    <section className="card guide" id={`guide-${item.id}`}>
      {item.slug && <span id={item.slug} className="guide__anchor" aria-hidden="true" />}
      {year && <span className="year-tag">ปี {year}</span>}
      <h3>{item.title}</h3>
      {/* views = its outside links opened; downloads = its files opened or saved (pictures shown in the page are not counted) */}
      {(hasLinks || all.length > 0) && (
        <HitStats
          views={hasLinks ? (hits.linkOpens.get(item.id) ?? 0) : undefined}
          downloads={all.length ? all.reduce((a, f) => a + (hits.downloads.get(f.id) ?? 0), 0) : undefined}
        />
      )}
      {item.body && <p>{item.body}</p>}
      {files.map((f) =>
        (f.mimeType ?? '').startsWith('image/') ? (
          <a key={f.id} href={fileUrl(f)} target="_blank" rel="noopener noreferrer" className="guide__image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${fileUrl(f)}?view=1`} alt={item.title} width={f.width ?? undefined} height={f.height ?? undefined} loading="lazy" />
          </a>
        ) : (
          <a key={f.id} href={fileUrl(f)} target="_blank" rel="noopener noreferrer" className="btn guide__file">
            <FileIcon file={f} size={24} />
            เปิดเอกสาร
          </a>
        ),
      )}
      {(item.links ?? []).length > 0 && (
        <ol className="guide__links">
          {item.links!.map((l, index) => {
            const href = isFile(l.file) ? fileUrl(l.file) : l.url
            return (
              <li key={l.id}>
                <span className="guide__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                {isFile(l.file) ? (
                  // a file: counted as a download when it is fetched
                  <a href={fileUrl(l.file)} target="_blank" rel="noopener noreferrer" className="guide__link">
                    <span>{l.title}</span>
                    <FileIcon file={l.file} size={24} />
                  </a>
                ) : href ? (
                  // an outside page: the click is counted as a view of this topic
                  <TrackedLink id={item.id} href={href} kind="guide_link" className="guide__link">
                    <span>{l.title}</span>
                  </TrackedLink>
                ) : (
                  l.title
                )}
              </li>
            )
          })}
        </ol>
      )}
      {item.sourceUrl && (
        <p className="guide__source muted">
          ที่มา:{' '}
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
            {item.sourceUrl.replace(/^https?:\/\//, '')}
          </a>
        </p>
      )}
    </section>
  )
}

// Central content (plans, indicator criteria, how-to guides): the same on every province site.
export default async function GuidesPage({ params, searchParams }: { params: Promise<{ province: string }>; searchParams: Promise<{ year?: string }> }) {
  const province = await getProvince((await params).province)
  if (!province) notFound()
  const payload = await getPayload({ config })
  const all = (await payload.find({ collection: 'central-contents', limit: 500, depth: 2, pagination: false, sort: 'sortOrder' })).docs
  const plan = all.filter((c) => c.section === 'plan')
  const howto = all.filter((c) => c.section === 'howto')
  const years = [...new Set(plan.map((c) => c.fiscalYear).filter((y): y is number => Boolean(y)))].sort((a, b) => b - a)
  const { selected, multi } = selectYears((await searchParams).year, years)
  const base = `/${province.slug}/guides`
  const [linkOpens, downloads] = await Promise.all([
    getHits('guide_link', all.map((c) => c.id)),
    getHits('file_download', all.flatMap((c) => topicFiles(c).map((f) => f.id))),
  ])
  const hits: Hits = { linkOpens, downloads }
  // the plan topics shown for the chosen years, newest first (the menu lists the same ones); a topic with no
  // year is for every year (as the backoffice says), so it is always shown, ahead of the dated ones
  const planShown = plan
    .filter((c) => !c.fiscalYear || selected.includes(c.fiscalYear))
    .sort((a, b) => (b.fiscalYear ?? 9999) - (a.fiscalYear ?? 9999))

  return (
    <>
      <PageExtras province={province} page="guides" />
      <main className="wrap page page--guides">
        <h1 className="page__title">แผนงานและคู่มือ</h1>
        <p className="muted">แผนการขับเคลื่อน เกณฑ์การประเมินตัวชี้วัด คู่มือและสื่อสนับสนุน จากส่วนกลาง</p>

        <div className="guides-layout">
          <GuideNav
            groups={[
              ...(plan.length ? [{ id: 'plan', title: 'แผนการขับเคลื่อนบัญชีข้อมูลจังหวัด', icon: 'plan' as const, items: planShown.map((c) => ({ id: `guide-${c.id}`, title: c.title })) }] : []),
              ...(howto.length ? [{ id: 'howto', title: 'คู่มือและสื่อสนับสนุน', icon: 'book' as const, items: howto.map((c) => ({ id: `guide-${c.id}`, title: c.title })) }] : []),
            ]}
          />
          <div className="guides-content">
        {plan.length > 0 && (
          <section className="block" id="plan">
            {/* the year choice applies to this group only, so it sits right above its band */}
            <div className="guides-years">
              <YearPicker years={years} selected={selected} base={base} hash="#plan" />
            </div>
            <div className="guides-heading"><Svg size={30}><path d="M5 3h10l4 4v14H5ZM14 3v5h5M8 12h8M8 16h6" /></Svg><h2>แผนการขับเคลื่อนบัญชีข้อมูลจังหวัด</h2></div>
            {planShown.map((c) => (
              <Item key={c.id} item={c} year={multi ? c.fiscalYear : null} hits={hits} />
            ))}
          </section>
        )}

        {howto.length > 0 && (
          <section className="block" id="howto">
            <div className="guides-heading"><Svg size={30}><path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15" /></Svg><h2>คู่มือและสื่อสนับสนุน</h2></div>
            {howto.map((c) => (
              <Item key={c.id} item={c} hits={hits} />
            ))}
          </section>
        )}
          {all.length === 0 && <div className="card empty">ยังไม่มีแผนงานและคู่มือ</div>}
          </div>
        </div>
      </main>
    </>
  )
}
