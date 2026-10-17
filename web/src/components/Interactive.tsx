'use client'

import React, { useEffect, useRef, useState } from 'react'

import { useConsent } from './Consent'
import { sendHit } from './Tools'

/**
 * Opens the preview when the page is reached with "#preview-<item id>" (the home page's latest documents
 * link here), and brings the document's row into view.
 */
function useOpenFromHash(itemId: string | undefined, canPreview: boolean, setOpen: (v: boolean) => void) {
  useEffect(() => {
    if (!itemId || !canPreview) return
    const fromHash = () => {
      if (window.location.hash !== `#preview-${itemId}`) return
      setOpen(true)
      const row = document.getElementById(`item-${itemId}`)
      // a short highlight that fades (styles.css); taken off afterwards so it can play again next time
      if (row) {
        row.classList.remove('is-flash')
        void row.offsetWidth
        row.classList.add('is-flash')
        window.setTimeout(() => row.classList.remove('is-flash'), 2600)
      }
      requestAnimationFrame(() => row?.scrollIntoView({ block: 'start' }))
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [itemId, canPreview, setOpen])
}

function PreviewPane({ url, kind, name, fileId }: { url: string; kind: string; name: string; fileId?: number }) {
  // one view each time the preview is opened (the ref keeps React's development double-run from counting twice)
  const counted = useRef(false)
  useEffect(() => {
    if (fileId && !counted.current) {
      counted.current = true
      sendHit('file_view', fileId)
    }
  }, [fileId])
  return (
    <div className="preview">
      {kind === 'PDF' ? (
        // "?view=1" marks this as a view (not a download) for the counters
        <iframe src={`${url}?view=1`} title={`ตัวอย่าง ${name}`} loading="lazy" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`${url}?view=1`} alt={name} />
      )}
    </div>
  )
}

/** A document row's file actions: download link plus an inline preview that loads only when opened. */
export function FilePreview({ url, kind, name, itemId, fileId }: { url: string; kind: string; name: string; itemId?: string; fileId?: number }) {
  const [open, setOpen] = useState(false)
  const canPreview = kind === 'PDF' || kind === 'รูปภาพ'
  useOpenFromHash(itemId, canPreview, setOpen)
  return (
    <>
      {/* downloading is the quiet action: an icon button with the save mark */}
      <a href={url} className={canPreview ? 'btn btn--icon' : 'btn'} target="_blank" rel="noopener noreferrer" aria-label={`ดาวน์โหลด ${kind}: ${name}`} title={`ดาวน์โหลด ${kind}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
        </svg>
        {!canPreview && <span>ดาวน์โหลด {kind}</span>}
      </a>
      {canPreview && (
        <button type="button" className={open ? 'btn btn--primary' : 'btn'} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? 'ปิดตัวอย่าง' : 'ดูตัวอย่าง'}
        </button>
      )}
      {open && <PreviewPane url={url} kind={kind} name={name} fileId={fileId} />}
    </>
  )
}

/**
 * A dataset step's file link (Template 1–3 inside an issue card). It has no preview button of its own;
 * the preview opens only when reached from the home page, and the card then widens to the full row.
 */
export function StepFile({ url, kind, name, itemId, fileId, children }: { url: string; kind: string; name: string; itemId: string; fileId?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const canPreview = kind === 'PDF' || kind === 'รูปภาพ'
  useOpenFromHash(itemId, canPreview, setOpen)
  return (
    <>
      {children}
      {open && (
        <>
          <button type="button" className="btn btn--sm btn--primary step__close" onClick={() => setOpen(false)}>
            ปิดตัวอย่าง
          </button>
          <PreviewPane url={url} kind={kind} name={name} fileId={fileId} />
        </>
      )}
    </>
  )
}

export type DashCard = { id: number; title: string; topicName: string | null; dot: string; text: string; bg: string; embedUrl: string | null; provider: string; views: number; thumb: string | null; year?: number | null }

/** Dashboard gallery: cards first, the embed is only loaded for the one the visitor opens. */
export function DashboardViewer({ items }: { items: DashCard[] }) {
  const [openId, setOpenId] = useState<number | null>(null)
  // views opened in this visit, so the number on the card moves when the visitor opens one
  const [extra, setExtra] = useState<Record<number, number>>({})
  const current = items.find((i) => i.id === openId) ?? null
  const consent = useConsent()
  const viewer = useRef<HTMLElement>(null)
  const scrollToViewer = useRef(false)

  const open = (id: number) => {
    if (id !== openId) {
      sendHit('dashboard_view', id)
      setExtra((x) => ({ ...x, [id]: (x[id] ?? 0) + 1 }))
    }
    setOpenId(id)
  }

  // a link to "#d-123" (e.g. a card on the province home page) opens that dashboard straight away
  useEffect(() => {
    const fromHash = () => {
      const id = Number(/^#d-(\d+)$/.exec(window.location.hash)?.[1])
      if (!id || !items.some((i) => i.id === id)) return
      scrollToViewer.current = true
      open(id)
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  useEffect(() => {
    if (!current || !scrollToViewer.current) return
    scrollToViewer.current = false
    viewer.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [current])
  return (
    <>
      {current && (
        <section className="card viewer" aria-live="polite" ref={viewer}>
          <div className="viewer__head">
            <div className="viewer__title">
              {current.topicName && (
                <span className="topic-tag" style={{ color: current.text }}>
                  <span className="topic-tag__dot" style={{ background: current.dot }} />
                  {current.topicName}
                </span>
              )}
              <h2>{current.title}</h2>
            </div>
            {current.embedUrl && (
              <a href={current.embedUrl} target="_blank" rel="noopener noreferrer" className="btn">
                เปิดเต็มหน้าจอ
              </a>
            )}
            <button type="button" className="btn" onClick={() => setOpenId(null)}>
              ปิด
            </button>
          </div>
          {!current.embedUrl ? (
            <div className="viewer__empty">รายการนี้ไม่มีแดชบอร์ดให้แสดงในหน้า</div>
          ) : consent.embeds ? (
            <iframe className="viewer__frame" src={current.embedUrl} title={current.title} allowFullScreen />
          ) : (
            // Embedded dashboards come from another provider that may set its own cookies: ask first.
            <div className="viewer__gate">
              <strong>แดชบอร์ดนี้แสดงผ่านผู้ให้บริการภายนอก</strong>
              <p>การแสดงในหน้านี้ต้องอนุญาตเนื้อหาฝังจากภายนอก ซึ่งผู้ให้บริการอาจวางคุกกี้ของตนเอง</p>
              <div className="viewer__gate-actions">
                <button type="button" className="btn btn--primary" onClick={() => consent.save({ analytics: consent.analytics, embeds: true })}>
                  อนุญาตและแสดงแดชบอร์ด
                </button>
                <a href={current.embedUrl} target="_blank" rel="noopener noreferrer" className="btn">
                  เปิดในแท็บใหม่
                </a>
              </div>
            </div>
          )}
        </section>
      )}
      <div className="grid-cards">
        {items.map((d) => (
          <button
            type="button"
            key={d.id}
            className={d.id === openId ? 'dash-card is-active' : 'dash-card'}
            style={{ '--card-tone': d.dot } as React.CSSProperties}
            aria-pressed={d.id === openId}
            onClick={() => {
              open(d.id)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            {d.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="dash-card__thumb dash-card__thumb--img" src={d.thumb} alt="" loading="lazy" />
            ) : (
              <span className="dash-card__thumb" style={{ background: d.bg, color: d.text }} aria-hidden="true">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M4 20V10" />
                  <path d="M10 20V4" />
                  <path d="M16 20v-7" />
                  <path d="M22 20H2" />
                </svg>
              </span>
            )}
            <span className="dash-card__body">
              <span className="dash-card__meta">
              {d.topicName && (
                <span className="topic-tag" style={{ color: d.text }}>
                  <span className="topic-tag__dot" style={{ background: d.dot }} />
                  {d.topicName}
                </span>
              )}
              {d.year && <span className="dash-card__year">ปี {d.year}</span>}
              </span>
              <span className="dash-card__title">{d.title}</span>
              <span className="dash-card__footer">
              <span className="dash-card__state">{d.id === openId ? 'กำลังแสดง' : 'ดูสารสนเทศ'}</span>
              <span className="hit-stats" title={`เข้าชม ${(d.views + (extra[d.id] ?? 0)).toLocaleString('th-TH')} ครั้ง`}>
                <span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span className="sr-only">เข้าชม</span>
                  {(d.views + (extra[d.id] ?? 0)).toLocaleString('th-TH')}
                  <span className="sr-only"> ครั้ง</span>
                </span>
              </span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </>
  )
}

