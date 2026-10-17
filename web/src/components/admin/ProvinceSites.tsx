'use client'

import React, { useMemo, useState } from 'react'

export type SiteCard = { id: number; slug: string; code: string; name: string; region: string; color: string; tint: string }

const PAGES = [
  { path: '', label: 'หน้าหลัก' },
  { path: '/utilization', label: 'สารสนเทศ' },
  { path: '/docs', label: 'เอกสาร' },
  { path: '/guides', label: 'แผนงาน' },
]

/** The 76 province sites as cards: type to find one, or narrow to a region; every page opens in a new tab. */
export function ProvinceSites({ sites, regions }: { sites: SiteCard[]; regions: string[] }) {
  const [q, setQ] = useState('')
  const [region, setRegion] = useState('')
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return sites.filter((s) => (!region || s.region === region) && (!t || s.name.includes(t) || s.slug.includes(t) || s.code.toLowerCase().includes(t)))
  }, [sites, q, region])

  return (
    <>
      <div className="agy-sites__bar" role="search">
        <label className="agy__field agy-sites__search">
          <span>ค้นหาจังหวัด</span>
          <span className="agy-search">
            <svg className="agy-search__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.6-3.6" />
            </svg>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์ชื่อจังหวัด หรือชื่อย่อในลิงก์ เช่น sisaket" autoFocus />
          </span>
        </label>
        <div className="agy-sites__regions" role="group" aria-label="ภาค">
          {['', ...regions].map((r) => (
            <button key={r || 'all'} type="button" className={`agy-sites__chip${region === r ? ' is-on' : ''}`} aria-pressed={region === r} onClick={() => setRegion(r)}>
              {r || 'ทุกภาค'}
              <span>{r ? sites.filter((s) => s.region === r).length : sites.length}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="agy__sub">{shown.length === sites.length ? `${sites.length} จังหวัด` : `พบ ${shown.length} จังหวัด`}</p>
      {shown.length === 0 ? (
        <div className="agy__card">ไม่พบจังหวัดที่ค้นหา</div>
      ) : (
        <div className="agy-sites__grid">
          {shown.map((s) => (
            <article key={s.id} className="agy-site" style={{ '--site': s.color, '--site-tint': s.tint } as React.CSSProperties}>
              <a className="agy-site__main" href={`/${s.slug}`} target="_blank" rel="noopener noreferrer" title={`เปิดหน้าเว็บจังหวัด${s.name} ในแท็บใหม่`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/logos/${s.code}.png`} alt="" width={52} height={52} loading="lazy" />
                <span>
                  <strong>{s.name}</strong>
                  <small>/{s.slug}</small>
                </span>
                <svg className="agy-site__out" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M7 17 17 7M8 7h9v9" />
                </svg>
              </a>
              <nav className="agy-site__pages" aria-label={`หน้าเว็บจังหวัด${s.name}`}>
                {PAGES.slice(1).map((p) => (
                  <a key={p.path} href={`/${s.slug}${p.path}`} target="_blank" rel="noopener noreferrer">
                    {p.label}
                  </a>
                ))}
                <a href={`/admin/collections/provinces/${s.id}`} className="agy-site__edit" title={`ปรับแต่งหน้าเว็บและข้อมูลสำนักงานจังหวัด${s.name}`} aria-label={`ปรับแต่งจังหวัด${s.name}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" />
                  </svg>
                </a>
              </nav>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
