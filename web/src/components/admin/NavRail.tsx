'use client'

import { useEffect } from 'react'

const WIDE = '(min-width: 769px)'

/**
 * Collapsing the sidebar on a computer leaves a narrow strip of menu icons that can still be clicked
 * (the look is in custom.scss under "icon rail"). Payload marks the closed sidebar `inert`, which would make
 * the icons dead, so on wide screens that mark is taken off again. Each entry also gets its name as a
 * tooltip, since only the icon shows. Phones keep Payload's own slide-in menu.
 */
export function NavRail() {
  useEffect(() => {
    const wide = window.matchMedia(WIDE)
    let nav: Element | null = null
    const fix = () => {
      nav = document.querySelector('aside.nav')
      if (!nav) return
      if (wide.matches && nav.hasAttribute('inert')) nav.removeAttribute('inert')
      for (const link of nav.querySelectorAll<HTMLElement>('.nav__link')) {
        const name = link.textContent?.trim()
        if (name && link.title !== name) link.title = name
      }
    }
    fix()
    // Payload sets `inert` again whenever the sidebar closes, and may draw the sidebar after this runs or
    // swap it out on navigation, so watch the whole page rather than one sidebar element
    const watch = new MutationObserver(fix)
    watch.observe(document.body, { attributes: true, attributeFilter: ['inert'], childList: true, subtree: true })
    const onSize = () => {
      if (!wide.matches && nav && !nav.classList.contains('nav--nav-open')) nav.setAttribute('inert', '')
      fix()
    }
    wide.addEventListener('change', onSize)
    return () => {
      watch.disconnect()
      wide.removeEventListener('change', onSize)
    }
  }, [])
  return null
}
