'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { useConsent } from './Consent'

type Gtag = (...args: unknown[]) => void
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
    [key: `ga-disable-${string}`]: boolean | undefined
  }
}

/** Google's own cookies for this property (_ga, _ga_<id>), removed when a visitor takes back consent. */
function dropGaCookies() {
  const host = location.hostname
  const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`]
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0].trim()
    if (!/^_ga(_|$)/.test(name)) continue
    for (const d of domains) document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`
  }
}

/**
 * Google Analytics 4 for the public pages, prepared but off until the central admin enters a
 * measurement ID in the site settings. Nothing from Google is loaded until the visitor allows the
 * "สถิติการใช้งาน" group in the cookie choice; taking it back stops sending and removes the _ga cookies.
 * Page views are sent on every move between pages (the site changes pages without a full reload),
 * each tagged with the province, so one property covers all 76 provinces.
 */
export function Analytics({ id, province }: { id: string; province: string }) {
  const { ready, analytics } = useConsent()
  const path = usePathname()
  const query = useSearchParams().toString()
  const loaded = useRef(false)

  // load gtag.js once, after consent; switch it off again if consent is withdrawn
  useEffect(() => {
    if (!ready) return
    if (analytics) {
      window[`ga-disable-${id}`] = false
      if (!loaded.current) {
        loaded.current = true
        window.dataLayer = window.dataLayer || []
        window.gtag = function gtag() {
          // gtag.js expects the arguments object itself
          // eslint-disable-next-line prefer-rest-params
          window.dataLayer!.push(arguments)
        }
        window.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
        window.gtag('js', new Date())
        window.gtag('config', id, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false })
        const s = document.createElement('script')
        s.async = true
        s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
        document.head.appendChild(s)
      }
      window.gtag?.('consent', 'update', { analytics_storage: 'granted' })
    } else if (loaded.current) {
      window.gtag?.('consent', 'update', { analytics_storage: 'denied' })
      window[`ga-disable-${id}`] = true
      dropGaCookies()
    }
  }, [ready, analytics, id])

  // one page view per page shown
  useEffect(() => {
    if (!ready || !analytics || !window.gtag) return
    window.gtag('event', 'page_view', {
      page_location: location.href,
      page_path: path + (query ? `?${query}` : ''),
      page_title: document.title,
      province,
    })
  }, [ready, analytics, path, query, province])

  return null
}
