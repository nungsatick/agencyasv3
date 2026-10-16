import config from '@payload-config'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'


import { PageExtras } from '@/components/PageExtras'
import { YearPicker } from '@/components/Tools'
import { FileIcon } from '@/components/FileIcon'
import { fileUrl, getProvince, selectYears } from '@/lib/data'
import type { CentralContent, File as FileDoc } from '@/payload-types'

const isFile = (f: unknown): f is FileDoc => typeof f === 'object' && f !== null

function Item({ item, year }: { item: CentralContent; year?: number | null }) {
  const files = (item.files ?? []).filter(isFile)
  return (
    <section className="card guide" id={item.slug}>
      {year && <span className="year-tag">ปี {year}</span>}
      <h3>{item.title}</h3>
      {item.body && <p>{item.body}</p>}
      {files.map((f) =>
        (f.mimeType ?? '').startsWith('image/') ? (
          <a key={f.id} href={fileUrl(f)} target="_blank" rel="noopener noreferrer" className="guide__image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl(f)} alt={item.title} loading="lazy" />
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
          {item.links!.map((l) => {
            const href = isFile(l.file) ? fileUrl(l.file) : l.url
            return (
              <li key={l.id}>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {l.title}
                  </a>
                ) : (
                  l.title
                )}
                {isFile(l.file) && <FileIcon file={l.file} size={20} />}
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

  return (
    <>
      <PageExtras province={province} page="guides" />
      <main className="wrap page">
        <h1 className="page__title">แผนงานและคู่มือ</h1>
        <p className="muted">แผนการขับเคลื่อน เกณฑ์การประเมินตัวชี้วัด และเทคนิคการขึ้นชุดข้อมูล จากส่วนกลาง</p>

        {plan.length > 0 && (
          <section className="block" id="plan">
            <h2>แผนการขับเคลื่อนบัญชีข้อมูลจังหวัด</h2>
            <YearPicker years={years} selected={selected} base={base} hash="#plan" />
            {plan
              .filter((c) => c.fiscalYear && selected.includes(c.fiscalYear))
              .sort((a, b) => (b.fiscalYear ?? 0) - (a.fiscalYear ?? 0))
              .map((c) => (
                <Item key={c.id} item={c} year={multi ? c.fiscalYear : null} />
              ))}
          </section>
        )}

        {howto.length > 0 && (
          <section className="block" id="howto">
            <h2>เทคนิคการขึ้นชุดข้อมูล</h2>
            {howto.map((c) => (
              <Item key={c.id} item={c} />
            ))}
          </section>
        )}
      </main>
    </>
  )
}
