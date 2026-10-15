'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* private mode: the choice just lasts for this page */
  }
}

/** Tell the server a visitor opened an external link or a dashboard (an anonymous running total). */
export const sendHit = (kind: 'doc_link' | 'dashboard_view', id: number) => {
  void fetch('/hit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id }), keepalive: true }).catch(() => undefined)
}

const SIZES = ['md', 'lg', 'xl'] as const
type Size = (typeof SIZES)[number]

/**
 * Header controls: text size and light / dark display. The choice is kept in this browser only
 * (localStorage, strictly a display preference). layout.tsx applies it before first paint.
 */
export function DisplayTools() {
  const [size, setSize] = useState<Size>('md')
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const s = read('agy_fs') as Size | null
    if (s && SIZES.includes(s)) setSize(s)
    setDark(read('agy_mode') === 'dark')
  }, [])

  const applySize = (s: Size) => {
    setSize(s)
    write('agy_fs', s)
    document.documentElement.dataset.fs = s
  }
  const toggleDark = () => {
    const next = !dark
    setDark(next)
    write('agy_mode', next ? 'dark' : 'light')
    document.documentElement.dataset.mode = next ? 'dark' : 'light'
  }
  const i = SIZES.indexOf(size)

  return (
    <div className="display-tools" role="group" aria-label="การแสดงผล">
      <button type="button" className="tool-btn" onClick={() => applySize(SIZES[i - 1])} disabled={i === 0} aria-label="ลดขนาดตัวอักษร" title="ลดขนาดตัวอักษร">
        ก<span aria-hidden="true">−</span>
      </button>
      <button type="button" className="tool-btn tool-btn--lg" onClick={() => applySize(SIZES[i + 1])} disabled={i === SIZES.length - 1} aria-label="เพิ่มขนาดตัวอักษร" title="เพิ่มขนาดตัวอักษร">
        ก<span aria-hidden="true">+</span>
      </button>
      <button type="button" className="tool-btn" onClick={toggleDark} aria-pressed={dark} aria-label="โหมดมืด" title={dark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {dark ? (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </>
          ) : (
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
          )}
        </svg>
      </button>
    </div>
  )
}

/**
 * Filters the documents already on the page while the visitor types. Works on the rendered rows
 * (anything with data-search), and hides a heading or card when none of its rows match.
 */
/**
 * Fiscal-year choice for the documents page: "ทั้งหมด", one year, or several years with Ctrl
 * (⌘ on a Mac) held while clicking. Every choice is a plain link, so it also works without
 * scripts; the script only handles the Ctrl-click, which a browser would otherwise open in a new tab.
 */
export function YearPicker({ years, selected, base, hash = '', hint = true }: { years: number[]; selected: number[]; base: string; hash?: string; hint?: boolean }) {
  const router = useRouter()
  const all = selected.length === years.length && years.length > 1
  const hrefFor = (ys: number[]) => (ys.length === years.length ? `${base}?year=all${hash}` : `${base}?year=${[...ys].sort((a, b) => b - a).join(',')}${hash}`)
  const pick = (e: React.MouseEvent<HTMLAnchorElement>, y: number) => {
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    const now = all ? [] : selected
    const next = now.includes(y) ? now.filter((x) => x !== y) : [...now, y]
    if (next.length) router.push(hrefFor(next), { scroll: false })
  }
  return (
    <div className="filters__row year-picker">
      <span className="filters__label" id="year-label">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
        ปีงบประมาณ
      </span>
      <div className="year-picker__pills" role="group" aria-labelledby="year-label">
        <a href={`${base}?year=all${hash}`} className={all ? 'seg is-active' : 'seg'} aria-current={all ? 'true' : undefined} onClick={(e) => { e.preventDefault(); router.push(`${base}?year=all${hash}`, { scroll: false }) }}>
          ทั้งหมด
        </a>
        {years.map((y) => {
          const on = !all && selected.includes(y)
          return (
            <a key={y} href={hrefFor([y])} className={on ? 'seg is-active' : 'seg'} aria-current={on ? 'true' : undefined} onClick={(e) => pick(e, y)}>
              {y}
            </a>
          )
        })}
      </div>
      {hint && <p className="filters__hint">กด Ctrl ค้างไว้แล้วคลิกปี เพื่อเลือกหลายปีพร้อมกัน</p>}
    </div>
  )
}

export function DocSearch({ total }: { total: number }) {
  const [q, setQ] = useState('')
  const [found, setFound] = useState(total)

  useEffect(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-search]'))
    let n = 0
    for (const el of rows) {
      const text = el.dataset.search ?? ''
      const hit = words.every((w) => text.includes(w))
      el.hidden = !hit
      if (hit) n++
    }
    for (const box of Array.from(document.querySelectorAll<HTMLElement>('[data-search-group]'))) {
      box.hidden = !box.querySelector('[data-search]:not([hidden])')
    }
    setFound(n)
  }, [q, total])

  return (
    <div className="filters__row doc-search">
      <label className="filters__label" htmlFor="doc-search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        ค้นหา
      </label>
      <span className="doc-search__box">
        <svg className="doc-search__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.6-3.6" />
        </svg>
        <input id="doc-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ชื่อเอกสาร ประเด็น หรือครั้งที่" title="ค้นจากชื่อเอกสาร ประเด็น หรือครั้งที่ประชุม" autoComplete="off" />
      </span>
      {q.trim() && (
        <span className="muted" role="status">
          {found ? `พบ ${found} จาก ${total} รายการ` : 'ไม่พบเอกสารที่ตรงกับคำค้น'}
        </span>
      )}
    </div>
  )
}

/** A document's external link; opening it adds one to the document's view count. */
export function TrackedLink({ id, href, children }: { id: number; href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="link-strong" target="_blank" rel="noopener noreferrer" onClick={() => sendHit('doc_link', id)} onAuxClick={() => sendHit('doc_link', id)}>
      {children}
    </a>
  )
}

/**
 * "Back to top" button in the bottom-right corner. It appears once the visitor has scrolled
 * about a screen down and glides back up (instantly for people who asked for reduced motion).
 */
export function BackToTop() {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 0.8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const up = () => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' })
    // keyboard users continue from the top of the page, not from the hidden button
    document.querySelector<HTMLElement>('.site-header a')?.focus({ preventScroll: true })
  }
  return (
    <button type="button" className={shown ? 'to-top is-shown' : 'to-top'} onClick={up} aria-label="กลับขึ้นด้านบน" title="กลับขึ้นด้านบน" tabIndex={shown ? 0 : -1} aria-hidden={!shown}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  )
}
