'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

const ACTIVE = 'agy-active'
const TITLE_ICON = 'agy-title-icon'
const CRUMB_ICON = 'agy-crumb-ic'

/** Where a menu entry leads. Payload renders the entry of the page being shown as a <div id="nav-…"> without a link. */
function targetOf(el: Element): string | null {
  const href = el.getAttribute('href')
  if (href) return href.split('?')[0]
  const id = el.id
  if (id.startsWith('nav-global-')) return `/admin/globals/${id.slice('nav-global-'.length)}`
  if (id.startsWith('nav-')) return `/admin/collections/${id.slice('nav-'.length)}`
  return null
}

/**
 * Lights up exactly one sidebar entry: the one whose address matches the page on screen most closely.
 * Covers Payload's menus, our own entries (statistics, reports, account) and our list screens at /admin/<slug>,
 * and stays lit after the mouse leaves. The page's heading gets the same icon in front of it.
 */
export function NavHighlight() {
  const path = usePathname()
  useEffect(() => {
    // our list screens (/admin/documents) belong to the same menu entry as /admin/collections/documents
    const here = document.querySelector(`#nav-${path.split('/')[2]}`) && /^\/admin\/[a-z-]+$/.test(path) ? path.replace('/admin/', '/admin/collections/') : path
    const apply = () => {
      const nav = document.querySelector('.nav')
      if (!nav) return
      let best: Element | null = null
      let bestLen = -1
      for (const el of nav.querySelectorAll('.nav__link')) {
        const t = targetOf(el)
        if (!t || el.getAttribute('target') === '_blank') continue
        const hit = here === t || (t !== '/admin' && here.startsWith(`${t}/`))
        if (hit && t.length > bestLen) {
          best = el
          bestLen = t.length
        }
      }
      for (const el of nav.querySelectorAll(`.${ACTIVE}`)) if (el !== best) el.classList.remove(ACTIVE)
      if (best && !best.classList.contains(ACTIVE)) best.classList.add(ACTIVE)
      // the page title gets the same icon as its menu entry
      const icon = best ? getComputedStyle(best).getPropertyValue('--agy-icon').trim() : ''
      const h1 = [...document.querySelectorAll('h1')].find((h) => !h.closest('.nav'))
      for (const h of document.querySelectorAll(`h1.${TITLE_ICON}`)) if (h !== h1 || !icon) h.classList.remove(TITLE_ICON)
      if (h1 && icon && h1.style.getPropertyValue('--agy-title-icon') !== icon) h1.style.setProperty('--agy-title-icon', icon)
      if (h1 && icon) h1.classList.add(TITLE_ICON)
      // breadcrumb: each step shows the icon of the menu entry it leads to, the last one the page's own
      const crumbs = document.querySelector('.step-nav')
      if (crumbs) {
        const links = [...nav.querySelectorAll('.nav__link')]
        const iconFor = (href: string) => {
          const want = href.split('?')[0].replace(/^\/admin\/([a-z-]+)$/, '/admin/collections/$1')
          const hit = links.find((l) => targetOf(l) === want)
          return hit ? getComputedStyle(hit).getPropertyValue('--agy-icon').trim() : ''
        }
        const mark = (el: HTMLElement, ic: string) => {
          if (!ic) return el.classList.remove(CRUMB_ICON)
          if (el.style.getPropertyValue('--agy-crumb-icon') !== ic) el.style.setProperty('--agy-crumb-icon', ic)
          el.classList.add(CRUMB_ICON)
        }
        for (const a of crumbs.querySelectorAll<HTMLAnchorElement>('a:not(.step-nav__home)')) mark(a, iconFor(a.getAttribute('href') ?? ''))
        const last = crumbs.querySelector<HTMLElement>('.step-nav__last')
        if (last) mark(last, icon)
      }
    }
    apply()
    // Payload re-renders its menu entries while navigating; put the highlight back when it does
    // (on a fresh page load the whole menu can be swapped out after this runs, so watch the page, not one menu)
    const obs = new MutationObserver(apply)
    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [path])
  return null
}
