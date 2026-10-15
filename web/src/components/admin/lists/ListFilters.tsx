'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect, useState } from 'react'

export type Opt = { value: string; label: string }
export type SelectDef = { key: string; label: string; all: string; options: Opt[] }
export type CheckDef = { key: string; label: string }

/**
 * Filter bar shared by every backoffice list: a search box, plain drop-downs and tick boxes.
 * Each change updates the address (?q=&year=...), so the server renders the matching rows and the
 * filtered list can be bookmarked or shared.
 */
export function ListFilters({ search, selects = [], checks = [] }: { search?: { label: string; placeholder: string }; selects?: SelectDef[]; checks?: CheckDef[] }) {
  const router = useRouter()
  const path = usePathname()
  const sp = useSearchParams()
  const [q, setQ] = useState(sp.get('q') ?? '')

  const go = (changes: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    next.delete('page') // a new filter starts again from page 1
    const qs = next.toString()
    router.push(qs ? `${path}?${qs}` : path)
  }

  // search after the person stops typing for a moment
  useEffect(() => {
    if (q === (sp.get('q') ?? '')) return
    const t = window.setTimeout(() => go({ q: q.trim() }), 400)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const keys = ['q', ...selects.map((s) => s.key), ...checks.map((c) => c.key)]
  const active = keys.some((k) => sp.get(k))

  return (
    <div className="agy-dl__filters" role="search">
      {search && (
        <label className="agy__field agy-dl__search">
          <span>{search.label}</span>
          <span className="agy-search">
            <svg className="agy-search__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.6-3.6" />
            </svg>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={search.placeholder} title={search.placeholder} />
          </span>
        </label>
      )}
      {selects.map((s) => (
        <label key={s.key} className="agy__field agy-dl__filter">
          <span>{s.label}</span>
          <select value={sp.get(s.key) ?? ''} onChange={(e) => go({ [s.key]: e.target.value })}>
            <option value="">{s.all}</option>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {checks.map((c) => (
        <label key={c.key} className="agy-dl__check">
          <input type="checkbox" checked={sp.get(c.key) === '1'} onChange={(e) => go({ [c.key]: e.target.checked ? '1' : '' })} />
          {c.label}
        </label>
      ))}
      {active && (
        <button
          type="button"
          className="agy__btn agy__btn--small"
          onClick={() => {
            setQ('')
            const next = new URLSearchParams(sp.toString())
            for (const k of [...keys, 'page']) next.delete(k)
            const qs = next.toString()
            router.push(qs ? `${path}?${qs}` : path)
          }}
        >
          ล้างตัวกรอง
        </button>
      )}
    </div>
  )
}
