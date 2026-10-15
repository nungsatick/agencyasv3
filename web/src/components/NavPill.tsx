'use client'

import { useEffect, useRef } from 'react'

type Box = { left: number; top: number; width: number; height: number }

// Where the highlight was on the previous page. Each page draws its own header, so the new header
// starts the highlight there and slides it to the current menu entry. (Lost on a full reload: no slide then.)
let last: Box | null = null

const boxOf = (link: HTMLElement): Box => ({ left: link.offsetLeft, top: link.offsetTop, width: link.offsetWidth, height: link.offsetHeight })

/**
 * The coloured highlight behind the current top-menu entry, as one element that slides left or right
 * to the entry that was clicked. People who ask their system for less motion get no slide.
 */
export function NavPill() {
  const pill = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = pill.current
    const nav = el?.parentElement
    if (!el || !nav) return
    const place = (b: Box, animate: boolean) => {
      el.style.transition = animate ? '' : 'none'
      el.style.transform = `translate(${b.left}px, ${b.top}px)`
      el.style.width = `${b.width}px`
      el.style.height = `${b.height}px`
      el.style.opacity = '1'
      last = b
    }
    const active = () => nav.querySelector<HTMLElement>('.nav-link.is-active')
    const current = active()
    if (!current) {
      el.style.opacity = '0'
      return
    }
    nav.classList.add('has-pill')
    const target = boxOf(current)
    if (last && (last.left !== target.left || last.top !== target.top)) {
      place(last, false)
      void el.offsetWidth // apply the starting point before sliding
      requestAnimationFrame(() => place(target, true))
    } else place(target, false)

    // slide at once on click, before the next page has loaded
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest<HTMLElement>('.nav-link')
      if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      nav.querySelectorAll('.nav-link.is-going').forEach((l) => l.classList.remove('is-going'))
      link.classList.add('is-going')
      place(boxOf(link), true)
    }
    let first = true
    const onResize = () => {
      // the observer also reports once when it starts; that must not cut the slide short
      if (first) return void (first = false)
      const a = nav.querySelector<HTMLElement>('.nav-link.is-going') ?? active()
      if (a) place(boxOf(a), false)
    }
    // window size, text size (ก+ / ก−) and wrapping menus all change where the entry sits
    const watch = new ResizeObserver(onResize)
    watch.observe(nav)
    nav.addEventListener('click', onClick)
    return () => {
      nav.removeEventListener('click', onClick)
      watch.disconnect()
    }
  }, [])

  return <span ref={pill} className="nav__pill" aria-hidden="true" />
}
