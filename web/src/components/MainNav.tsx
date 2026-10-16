'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLayoutEffect, useRef, useState } from 'react'

type Page = 'home' | 'utilization' | 'docs' | 'guides'

const ITEMS: { key: Page; path: string; label: string }[] = [
  { key: 'home', path: '', label: 'หน้าหลัก' },
  { key: 'utilization', path: '/utilization', label: 'สารสนเทศเพื่อการตัดสินใจ' },
  { key: 'docs', path: '/docs', label: 'เอกสาร' },
  { key: 'guides', path: '/guides', label: 'แผนงานและคู่มือ' },
]

/**
 * The province site's top menu. It lives in the province layout, so it stays on screen while pages change;
 * the coloured highlight is one element that slides to the clicked entry at once (before the next page has
 * loaded) and settles on the current page's entry. People who ask their system for less motion get no slide.
 */
export function MainNav({ base }: { base: string }) {
  const pathname = usePathname()
  const active = ITEMS.find((i) => i.path && pathname.startsWith(base + i.path))?.key ?? (pathname === base ? 'home' : null)
  // the entry clicked while its page is loading; cleared when the address changes
  const [going, setGoing] = useState<{ key: Page; from: string } | null>(null)
  const current = going && going.from === pathname ? going.key : active

  const nav = useRef<HTMLElement>(null)
  const pill = useRef<HTMLSpanElement>(null)
  const placed = useRef(false)
  // until the sliding highlight is placed, the current entry keeps its own background (first load, before scripts)
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const el = pill.current
    const link = nav.current?.querySelector<HTMLElement>(`[data-key="${current}"]`)
    if (!el) return
    if (!link) {
      el.style.opacity = '0'
      return
    }
    const place = (animate: boolean) => {
      el.style.transition = animate ? '' : 'none'
      el.style.transform = `translate(${link.offsetLeft}px, ${link.offsetTop}px)`
      el.style.width = `${link.offsetWidth}px`
      el.style.height = `${link.offsetHeight}px`
      el.style.opacity = '1'
    }
    // the first time it just appears; afterwards it slides
    place(placed.current)
    placed.current = true
    setReady(true)
    // window size, text size (ก+ / ก−) and a wrapping menu move the entry: follow without sliding
    // (the observer also reports once when it starts; that must not cut the slide short)
    let started = false
    const watch = new ResizeObserver(() => (started ? place(false) : (started = true)))
    watch.observe(nav.current!)
    return () => watch.disconnect()
  }, [current])

  return (
    <nav className={ready ? 'nav has-pill' : 'nav'} aria-label="เมนูหลัก" ref={nav}>
      <span ref={pill} className="nav__pill" aria-hidden="true" />
      {ITEMS.map((i) => (
        <Link
          key={i.key}
          href={base + i.path}
          data-key={i.key}
          className={`nav-link${current === i.key ? ' is-active' : ''}`}
          aria-current={active === i.key ? 'page' : undefined}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
            setGoing(i.key === active ? null : { key: i.key, from: pathname })
          }}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  )
}
