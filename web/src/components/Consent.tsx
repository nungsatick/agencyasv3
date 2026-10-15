'use client'

import Link from 'next/link'
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

type Choice = { v: number; analytics: boolean; embeds: boolean; id: string }
type Ctx = { ready: boolean; decided: boolean; analytics: boolean; embeds: boolean; save: (c: { analytics: boolean; embeds: boolean }) => void; openSettings: () => void }

// each province site keeps its own answer: people use the site of their own province
const keyFor = (scope: string) => `agy_consent:${scope}`
const ConsentContext = createContext<Ctx>({ ready: false, decided: false, analytics: false, embeds: false, save: () => undefined, openSettings: () => undefined })
export const useConsent = () => useContext(ConsentContext)

function read(scope: string, policyVersion: number): Choice | null {
  try {
    const c = JSON.parse(window.localStorage.getItem(keyFor(scope)) ?? 'null') as Choice | null
    return c && c.v === policyVersion ? c : null // a newer policy asks again
  } catch {
    return null
  }
}

/** Cookie consent for one province's pages (`scope` = its slug): banner on first visit, settings dialog any time from the footer. */
export function ConsentProvider({ scope, policyVersion, analyticsTool = null, children }: { scope: string; policyVersion: number; analyticsTool?: string | null; children: React.ReactNode }) {
  const [choice, setChoice] = useState<Choice | null>(null)
  const [ready, setReady] = useState(false)
  const [settings, setSettings] = useState(false)
  const [draft, setDraft] = useState({ analytics: false, embeds: false })
  const dialog = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setChoice(read(scope, policyVersion))
    setReady(true)
  }, [scope, policyVersion])

  const save = useCallback(
    (c: { analytics: boolean; embeds: boolean }) => {
      const id = choice?.id ?? (crypto.randomUUID?.() ?? String(Math.random()).slice(2))
      const next: Choice = { v: policyVersion, analytics: c.analytics, embeds: c.embeds, id }
      try {
        window.localStorage.setItem(keyFor(scope), JSON.stringify(next))
      } catch {
        /* storage blocked: the choice still applies for this page view */
      }
      setChoice(next)
      setSettings(false)
      // keep an anonymous record of the consent; failure here must not bother the visitor
      void fetch('/api/cookie-consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId: id, policyVersion, analytics: c.analytics, thirdParty: c.embeds }),
      }).catch(() => undefined)
    },
    [choice, scope, policyVersion],
  )

  const openSettings = useCallback(() => {
    setDraft({ analytics: choice?.analytics ?? false, embeds: choice?.embeds ?? false })
    setSettings(true)
  }, [choice])

  useEffect(() => {
    if (!settings) return
    dialog.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSettings(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settings])

  const value: Ctx = { ready, decided: Boolean(choice), analytics: choice?.analytics ?? false, embeds: choice?.embeds ?? false, save, openSettings }

  return (
    <ConsentContext.Provider value={value}>
      {children}

      {ready && !choice && !settings && (
        <div className="cookie-banner" role="region" aria-label="การใช้คุกกี้">
          <svg className="cookie-banner__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3a9 9 0 1 0 9 9 3 3 0 0 1-3-3 3 3 0 0 1-3-3 3 3 0 0 1-3-3Z" />
            <path d="M8.5 11.5h.01M12.5 15.5h.01M8 16h.01M15.5 12h.01" />
          </svg>
          <p className="cookie-banner__text">
            <strong>เว็บไซต์นี้ใช้คุกกี้</strong> ที่จำเป็นต่อการทำงาน และขออนุญาตใช้เพิ่มเพื่อแสดงแดชบอร์ด Power BI และเก็บสถิติการใช้งาน{' '}
            <Link href="/policy/cookies">นโยบายคุกกี้</Link>
          </p>
          <div className="cookie-banner__actions">
            <button type="button" className="linkish" onClick={openSettings}>ตั้งค่า</button>
            <button type="button" className="btn btn--sm btn--outline" onClick={() => save({ analytics: false, embeds: false })}>ปฏิเสธที่ไม่จำเป็น</button>
            <button type="button" className="btn btn--sm btn--primary" onClick={() => save({ analytics: true, embeds: true })}>ยอมรับทั้งหมด</button>
          </div>
        </div>
      )}

      {settings && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setSettings(false)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="cookie-title" tabIndex={-1} ref={dialog}>
            <div className="dialog__head">
              <div>
                <h2 id="cookie-title">ตั้งค่าคุกกี้</h2>
                <p className="muted">เปลี่ยนการตั้งค่านี้ได้ทุกเมื่อจากลิงก์ที่ส่วนท้ายของหน้า</p>
              </div>
              <button type="button" className="btn btn--icon" aria-label="ปิด" onClick={() => setSettings(false)}>✕</button>
            </div>
            <div className="dialog__body">
              <div className="cookie-row">
                <div>
                  <strong>คุกกี้ที่จำเป็น</strong>
                  <p className="muted">จำปีงบประมาณที่เลือก ประกาศที่ปิดไปแล้ว และผลการตั้งค่านี้ รวมถึงการเข้าสู่ระบบของเจ้าหน้าที่</p>
                </div>
                <span className="tag">เปิดเสมอ</span>
              </div>
              <label className="cookie-row">
                <span>
                  <strong>เนื้อหาฝังจากภายนอก</strong>
                  <span className="muted">แสดงแดชบอร์ด Power BI ในหน้าเว็บ ผู้ให้บริการอาจวางคุกกี้ของตนเอง</span>
                </span>
                <input type="checkbox" checked={draft.embeds} onChange={(e) => setDraft({ ...draft, embeds: e.target.checked })} />
              </label>
              <label className="cookie-row">
                <span>
                  <strong>สถิติการใช้งาน</strong>
                  <span className="muted">
                    {analyticsTool
                      ? `ใช้ ${analyticsTool} เก็บสถิติการเข้าชมแบบภาพรวม เช่น หน้าที่เปิดและประเภทอุปกรณ์ เพื่อปรับปรุงเว็บไซต์ ผู้ให้บริการจะวางคุกกี้ของตนเอง (_ga)`
                      : 'สำหรับสถิติเชิงลึกในอนาคต ขณะนี้ระบบยังไม่เก็บข้อมูลกลุ่มนี้ มีเพียงตัวนับจำนวนครั้งที่เปิดหน้าซึ่งไม่ระบุตัวบุคคล'}
                  </span>
                </span>
                <input type="checkbox" checked={draft.analytics} onChange={(e) => setDraft({ ...draft, analytics: e.target.checked })} />
              </label>
            </div>
            <div className="dialog__foot">
              <button type="button" className="btn btn--outline" onClick={() => save({ analytics: false, embeds: false })}>ปฏิเสธที่ไม่จำเป็น</button>
              <button type="button" className="btn btn--outline" onClick={() => save({ analytics: true, embeds: true })}>ยอมรับทั้งหมด</button>
              <button type="button" className="btn btn--primary" onClick={() => save(draft)}>บันทึกการตั้งค่า</button>
            </div>
          </div>
        </div>
      )}
    </ConsentContext.Provider>
  )
}

export function CookieSettingsButton() {
  const { openSettings } = useConsent()
  return (
    <button type="button" className="site-footer__cookie" onClick={openSettings}>
      ตั้งค่าคุกกี้
    </button>
  )
}

type PopupData = { key: string; title: string | null; body: string | null; imageUrl: string | null; imageAlt: string | null; buttonLabel: string | null; buttonUrl: string | null; frequency: 'always' | 'daily' | 'once' }

/** Announcement pop-up. Remembers that it was closed (per province and announcement version) in localStorage. */
const AUTO_CLOSE = 10 // seconds

export function AnnouncementPopup({ popup }: { popup: PopupData }) {
  const [open, setOpen] = useState(false)
  const [hideToday, setHideToday] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const storeKey = `agy_popup_${popup.key}`

  useEffect(() => {
    let seen: string | null = null
    try {
      seen = window.localStorage.getItem(storeKey)
    } catch {
      /* ignore */
    }
    const today = new Date().toDateString()
    // "ไม่ต้องแสดงอีกวันนี้" hides it for the rest of the day whatever the frequency
    const hide = seen === `today:${today}` || (popup.frequency === 'once' && seen) || (popup.frequency === 'daily' && (seen === today || seen === `today:${today}`))
    if (!hide) setOpen(true)
  }, [popup.frequency, storeKey])

  const close = useCallback(() => {
    try {
      const today = new Date().toDateString()
      window.localStorage.setItem(storeKey, hideToday ? `today:${today}` : today)
    } catch {
      /* ignore */
    }
    setOpen(false)
  }, [hideToday, storeKey])

  // closes by itself after AUTO_CLOSE seconds; resting the pointer on it (or touching it) pauses the count
  const [left, setLeft] = useState(AUTO_CLOSE)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (!open || paused) return
    if (left <= 0) return close()
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => window.clearTimeout(t)
  }, [open, paused, left, close])

  useEffect(() => {
    if (!open) return
    box.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null
  // visitors see the picture and, under it, the short description; the title only names the dialog for screen readers
  const alt = popup.imageAlt || popup.title || 'ภาพประกาศ'
  const picture = popup.imageUrl && (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="popup__image" src={popup.imageUrl} alt={alt} />
  )
  // without a button label, the picture itself leads to the link
  const linkedPicture =
    picture && popup.buttonUrl && !popup.buttonLabel ? (
      <a href={popup.buttonUrl} onClick={close} className="popup__image-link">
        {picture}
      </a>
    ) : (
      picture
    )
  return (
    <div className="overlay popup" onClick={(e) => e.target === e.currentTarget && close()}>
      <div
        className={`dialog popup__box${popup.imageUrl ? ' popup__box--image' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={popup.title || popup.imageAlt || 'ประกาศ'}
        tabIndex={-1}
        ref={box}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
      >
        <button type="button" className="btn btn--icon popup__close" aria-label="ปิดประกาศ" onClick={close}>✕</button>
        {linkedPicture}
        {popup.body && <p className={`popup__caption${popup.imageUrl ? '' : ' popup__caption--alone'}`}>{popup.body}</p>}
        <div className="popup__foot">
          <span className="popup__timer" aria-hidden="true" style={{ width: `${(left / AUTO_CLOSE) * 100}%` }} />
          <label className="popup__never">
            <input type="checkbox" checked={hideToday} onChange={(e) => setHideToday(e.target.checked)} /> ไม่ต้องแสดงอีกวันนี้
          </label>
          <div className="popup__actions">
            <span className="popup__count" aria-live="off">
              {paused ? 'หยุดนับชั่วคราว' : `ปิดเองใน ${left} วินาที`}
            </span>
            {popup.buttonLabel && popup.buttonUrl && (
              <a className="btn btn--primary btn--sm" href={popup.buttonUrl} onClick={close}>
                {popup.buttonLabel}
              </a>
            )}
            <button type="button" className="btn btn--sm" onClick={close}>ปิด</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Counts one page view. Runs in the browser so most crawlers are never counted. */
export function VisitBeacon({ slug, page }: { slug: string; page: string }) {
  useEffect(() => {
    void fetch('/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, page }), keepalive: true }).catch(() => undefined)
  }, [slug, page])
  return null
}
