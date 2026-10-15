import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { PageExtras } from '@/components/PageExtras'

import { SiteHeader } from '@/components/Chrome'
import { type DashCard, DashboardViewer } from '@/components/Interactive'
import { YearPicker } from '@/components/Tools'
import { distinctYears, fileUrl, getDashboards, getProvince, selectYears } from '@/lib/data'
import { getHits } from '@/lib/site'
import type { File as FileDoc } from '@/payload-types'
import { topicColor } from '@/lib/themes'

export default async function UtilizationPage({
  params,
  searchParams,
}: {
  params: Promise<{ province: string }>
  searchParams: Promise<{ year?: string; topic?: string }>
}) {
  const province = await getProvince((await params).province)
  if (!province) notFound()
  const sp = await searchParams
  const all = await getDashboards(province.id)
  const years = distinctYears(all)
  const { selected, multi, param } = selectYears(sp.year, years)
  const ofYear = all.filter((d) => selected.includes(d.fiscalYear))
  const topics = [...new Map(ofYear.filter((d) => d.topic).map((d) => [d.topic!.slug, d.topic!])).values()]
  const topic = topics.some((t) => t.slug === sp.topic) ? sp.topic : undefined
  const shown = ofYear.filter((d) => !topic || d.topic?.slug === topic)
  const base = `/${province.slug}/utilization`
  const href = (t?: string) => `${base}?year=${param}${t ? `&topic=${t}` : ''}`

  const views = await getHits('dashboard_view', shown.map((d) => d.id))
  const items: DashCard[] = shown.map((d) => {
    const { label: _label, ...c } = topicColor(d.topic)
    const thumb = d.thumbnail && typeof d.thumbnail === 'object' ? `${fileUrl(d.thumbnail as FileDoc)}?cover=1` : null
    return { id: d.id, title: d.title, topicName: d.topic?.nameTh ?? null, ...c, embedUrl: d.embedUrl ?? null, provider: d.provider ?? 'other', views: views.get(d.id) ?? 0, thumb, year: multi ? d.fiscalYear : null }
  })

  return (
    <>
      <SiteHeader province={province} active="utilization" />
      <PageExtras province={province} page="utilization" />
      <main className="wrap page">
        <h1 className="page__title">สารสนเทศเพื่อการตัดสินใจ</h1>
        <p className="muted">
          แดชบอร์ดวิเคราะห์ข้อมูลตามประเด็นการพัฒนาของจังหวัด{province.nameTh} {all.length} รายการ
        </p>

        {years.length === 0 ? (
          <div className="card empty">ยังไม่มีแดชบอร์ด</div>
        ) : (
          <>
            <div className="filters">
              <YearPicker years={years} selected={selected} base={base} />
              {topics.length > 1 && (
                <div className="filters__row">
                  <span className="filters__label">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 4h7l9 9-7 7-9-9z" />
                      <circle cx="8.5" cy="8.5" r="1.2" />
                    </svg>
                    ประเด็น
                  </span>
                  <Link href={href()} className={!topic ? 'tpill is-active' : 'tpill'} scroll={false} aria-current={!topic ? 'true' : undefined}>
                    ทั้งหมด <span className="tpill__n">{ofYear.length}</span>
                  </Link>
                  {topics.map((t) => {
                    const tone = topicColor(t)
                    const on = topic === t.slug
                    return (
                      <Link
                        key={t.slug}
                        href={href(t.slug ?? undefined)}
                        className={on ? 'tpill is-active' : 'tpill'}
                        scroll={false}
                        aria-current={on ? 'true' : undefined}
                        style={{ '--tp-dot': tone.dot, '--tp-bg': tone.bg, '--tp-text': tone.text } as React.CSSProperties}
                      >
                        <span className="tpill__dot" aria-hidden="true" />
                        {t.nameTh} <span className="tpill__n">{ofYear.filter((d) => d.topic?.slug === t.slug).length}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
            <DashboardViewer items={items} />
          </>
        )}
      </main>
    </>
  )
}
