'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import React, { useState } from 'react'

import { LIMITS } from './limits'

/** Page numbers to show: always the first and last, two either side of the current one, "…" for the gaps. */
function pageList(page: number, total: number): (number | '…')[] {
  const out: (number | '…')[] = []
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || Math.abs(p - page) <= 2) out.push(p)
    else if (out[out.length - 1] !== '…') out.push('…')
  }
  // a gap hiding just one page reads better as that page's number
  return out.map((v, i) => {
    const before = out[i - 1]
    const after = out[i + 1]
    return v === '…' && typeof before === 'number' && typeof after === 'number' && after - before === 2 ? before + 1 : v
  })
}

const Arrow = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

/**
 * Paging for the backoffice lists. Full (under the table): first / previous / page numbers / next / last,
 * a "go to page" box and the page size. Compact (above the table): previous, "หน้า x / y", next.
 */
export function Pager({ page, totalPages, limit, compact = false }: { page: number; totalPages: number; limit: number; compact?: boolean }) {
  const path = usePathname()
  const sp = useSearchParams()
  const router = useRouter()
  const [jump, setJump] = useState('')

  const href = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(changes)) {
      if (v === undefined || v === '' || (k === 'page' && v === 1)) next.delete(k)
      else next.set(k, String(v))
    }
    const qs = next.toString()
    return qs ? `${path}?${qs}` : path
  }
  const step = (to: number, label: string, d: string, extra = '') =>
    to >= 1 && to <= totalPages && to !== page ? (
      <Link className={`agy-pg__btn${extra}`} href={href({ page: to })} aria-label={label} title={label}>
        <Arrow d={d} />
      </Link>
    ) : (
      <span className={`agy-pg__btn is-off${extra}`} aria-hidden="true">
        <Arrow d={d} />
      </span>
    )

  if (compact)
    return totalPages > 1 ? (
      <nav className="agy-pg agy-pg--compact" aria-label="เลื่อนหน้า (ด้านบน)">
        {step(page - 1, 'หน้าก่อนหน้า', 'M15 6l-6 6 6 6')}
        <span className="agy-pg__where">
          หน้า <strong>{page}</strong> / {totalPages}
        </span>
        {step(page + 1, 'หน้าถัดไป', 'M9 6l6 6-6 6')}
      </nav>
    ) : null

  const go = (e: React.FormEvent) => {
    e.preventDefault()
    const n = Math.min(totalPages, Math.max(1, Math.round(Number(jump))))
    if (n) router.push(href({ page: n }))
    setJump('')
  }

  return (
    <nav className="agy-pg" aria-label="เลื่อนหน้า">
      {totalPages > 1 ? (
        <div className="agy-pg__nums">
          {step(1, 'หน้าแรก', 'M17 6l-6 6 6 6M11 6l-6 6 6 6', ' agy-pg__edge')}
          {step(page - 1, 'หน้าก่อนหน้า', 'M15 6l-6 6 6 6')}
          {pageList(page, totalPages).map((p, i) =>
            p === '…' ? (
              <span key={`gap${i}`} className="agy-pg__gap" aria-hidden="true">
                …
              </span>
            ) : p === page ? (
              <span key={p} className="agy-pg__num is-on" aria-current="page">
                {p}
              </span>
            ) : (
              <Link key={p} className={`agy-pg__num${Math.abs(p - page) === 2 && p !== 1 && p !== totalPages ? ' agy-pg__far' : ''}`} href={href({ page: p })} aria-label={`หน้า ${p}`}>
                {p}
              </Link>
            ),
          )}
          {step(page + 1, 'หน้าถัดไป', 'M9 6l6 6-6 6')}
          {step(totalPages, 'หน้าสุดท้าย', 'M7 6l6 6-6 6M13 6l6 6-6 6', ' agy-pg__edge')}
        </div>
      ) : (
        <span />
      )}
      <div className="agy-pg__tools">
        {totalPages > 3 && (
          <form className="agy-pg__jump" onSubmit={go}>
            <label htmlFor="agy-pg-jump">ไปหน้า</label>
            <input id="agy-pg-jump" type="number" inputMode="numeric" min={1} max={totalPages} value={jump} placeholder={String(page)} onChange={(e) => setJump(e.target.value)} />
            <button type="submit" className="agy__btn agy__btn--small">
              ไป
            </button>
          </form>
        )}
        <label className="agy-pg__size">
          แสดงหน้าละ
          <select value={limit} onChange={(e) => router.push(href({ limit: e.target.value, page: undefined }))}>
            {LIMITS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          รายการ
        </label>
      </div>
    </nav>
  )
}
