'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import React from 'react'

/**
 * Fiscal-year choice for backoffice screens, shaped like the public site's: "ทั้งหมด" (the default)
 * or one year, and Ctrl (⌘) + click to add or remove more years. Writes ?year=all / ?year=2569,2568.
 */
export function AdminYearPicker({ years, selected, all: allProp }: { years: number[]; selected: number[]; all?: boolean }) {
  const router = useRouter()
  const path = usePathname()
  const sp = useSearchParams()
  // "ทั้งหมด" is lit when nothing is picked; a page may say so itself (a single year then still reads as a choice)
  const all = allProp ?? selected.length === years.length
  const href = (ys: number[] | 'all') => {
    const next = new URLSearchParams(sp.toString())
    if (ys === 'all') next.delete('year')
    else next.set('year', [...ys].sort((a, b) => b - a).join(','))
    const qs = next.toString()
    return qs ? `${path}?${qs}` : path
  }
  const pick = (e: React.MouseEvent, y: number) => {
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    const now = all ? [] : selected
    const next = now.includes(y) ? now.filter((x) => x !== y) : [...now, y]
    if (next.length) router.push(href(next), { scroll: false })
  }
  return (
    <div className="agy-years" role="group" aria-label="ปีงบประมาณ">
      <span className="agy-years__label">ปีงบประมาณ</span>
      <div className="agy-years__seg">
        <Link href={href('all')} scroll={false} className={all ? 'is-on' : ''} aria-current={all ? 'true' : undefined}>
          ทั้งหมด
        </Link>
        {years.map((y) => {
          const on = !all && selected.includes(y)
          return (
            <Link key={y} href={href([y])} scroll={false} className={on ? 'is-on' : ''} aria-current={on ? 'true' : undefined} onClick={(e) => pick(e, y)}>
              {y}
            </Link>
          )
        })}
      </div>
      <span className="agy-years__hint">กด Ctrl ค้างไว้แล้วคลิกปี เพื่อเลือกหลายปี</span>
    </div>
  )
}
