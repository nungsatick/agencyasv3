'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import { THAI_MAP, THAI_MAP_VIEWBOX } from '@/lib/thaiMapPaths'

export type MapItem = {
  id: number
  code: string
  nameTh: string
  /** page views in the chosen period */
  views: number
  /** minutes since the last counted view today; null when nobody came today */
  ago: number | null
  href: string
}

/** A province counts as "being visited now" when its last view was this recent. */
export const LIVE_MINUTES = 15
const REFRESH_MS = 60_000
// light to dark, the backoffice blue; no views at all is grey
const SHADES = ['#d3e6ef', '#a6cde0', '#68a5c4', '#2b789e', '#0a4f6e']
const NONE = '#e6eaee'

const [, , VBW, VBH] = THAI_MAP_VIEWBOX.split(' ').map(Number)

// Bangkok and the small provinces around it, drawn again larger in a box over the Gulf of Thailand
const INSET_CODES = ['BKK', 'NBI', 'PTE', 'SPK', 'SKN', 'SKM', 'NPT', 'AYA', 'ATG', 'SBR']
const INSET_BOX = { x: 335, y: 655, w: 250, h: 250 }
const inset = (() => {
  const pts = INSET_CODES.map((c) => THAI_MAP[c])
  const pad = 16
  const x0 = Math.min(...pts.map((p) => p.cx)) - pad
  const x1 = Math.max(...pts.map((p) => p.cx)) + pad
  const y0 = Math.min(...pts.map((p) => p.cy)) - pad
  const y1 = Math.max(...pts.map((p) => p.cy)) + pad
  const k = Math.min(INSET_BOX.w / (x1 - x0), (INSET_BOX.h - 26) / (y1 - y0))
  // centred in the box, below its title line
  const ox = INSET_BOX.x + (INSET_BOX.w - (x1 - x0) * k) / 2 - x0 * k
  const oy = INSET_BOX.y + 26 + (INSET_BOX.h - 26 - (y1 - y0) * k) / 2 - y0 * k
  return { k, ox, oy, at: (x: number, y: number) => ({ x: ox + x * k, y: oy + y * k }) }
})()

const n = (v: number) => v.toLocaleString('th-TH')
const agoText = (m: number) => (m < 1 ? 'เมื่อสักครู่' : m < 60 ? `${m} นาทีที่แล้ว` : `${Math.floor(m / 60)} ชั่วโมงที่แล้ว`)

/** Five shades split at the quintiles of the provinces that have views, so a few busy provinces do not wash out the rest. */
function shading(values: number[]) {
  const sorted = values.filter((v) => v > 0).sort((a, b) => a - b)
  if (!sorted.length) return { shade: () => NONE, steps: [] as { color: string; from: number; to: number }[] }
  const cut = [0.2, 0.4, 0.6, 0.8].map((q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))])
  const level = (v: number) => cut.filter((c) => v > c).length
  const steps = SHADES.map((color, i) => ({ color, from: i === 0 ? sorted[0] : cut[i - 1] + 1, to: i === 4 ? sorted[sorted.length - 1] : cut[i] }))
    // equal cut points leave empty steps; keep only the ones some province falls in
    .filter((_, i) => sorted.some((v) => level(v) === i))
  return { shade: (v: number) => (v > 0 ? SHADES[level(v)] : NONE), steps }
}

type Hover = { code: string; x: number; y: number }

/**
 * Visits by province on a map of Thailand: darker = more views in the period, a pulsing dot = someone
 * opened the province's site in the last 15 minutes. Hover (or focus) for the numbers, click to open that
 * province's statistics. Bangkok's small neighbours are repeated larger in a box over the Gulf.
 * Reloads its data every minute while the tab is visible.
 */
export function ThaiVisitMap({ items, periodText, updatedAt }: { items: MapItem[]; periodText: string; updatedAt: string }) {
  const router = useRouter()
  const [hover, setHover] = useState<Hover | null>(null)
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, REFRESH_MS)
    return () => window.clearInterval(t)
  }, [router])

  const byCode = new Map(items.map((i) => [i.code, i]))
  const { shade, steps } = shading(items.map((i) => i.views))
  const isLive = (i?: MapItem) => !!i && i.ago !== null && i.ago < LIVE_MINUTES
  const live = items.filter(isLive).sort((a, b) => (a.ago ?? 0) - (b.ago ?? 0))
  const top = items.filter((i) => i.views > 0).sort((a, b) => b.views - a.views).slice(0, 10)
  const shown = hover ? byCode.get(hover.code) : undefined

  /** One province's shape, linked, in the main map or (zoomed) in the inset. */
  const province = (code: string, where: 'main' | 'inset') => {
    const geo = THAI_MAP[code]
    const it = byCode.get(code)
    const point = where === 'inset' ? inset.at(geo.cx, geo.cy) : { x: geo.cx, y: geo.cy }
    if (!it) {
      // Bangkok (not one of the 76): drawn for orientation only
      return <path key={code} d={geo.d} className="agy-geomap__shape is-blank" vectorEffect="non-scaling-stroke" />
    }
    const enter = () => setHover({ code, ...point })
    const leave = () => setHover((h) => (h?.code === code ? null : h))
    return (
      <a
        key={code}
        href={it.href}
        className={`agy-geomap__prov${isLive(it) ? ' is-live' : ''}${hover?.code === code ? ' is-hover' : ''}`}
        aria-label={`${it.nameTh} ${n(it.views)} ครั้ง${isLive(it) ? ' กำลังมีผู้เข้าชม' : ''}`}
        onClick={(e) => {
          e.preventDefault()
          router.push(it.href)
        }}
        onMouseEnter={enter}
        onMouseLeave={leave}
        onFocus={enter}
        onBlur={leave}
      >
        <path d={geo.d} className="agy-geomap__shape" style={{ fill: shade(it.views) }} vectorEffect="non-scaling-stroke" />
      </a>
    )
  }
  // pulsing dots go on top of every shape, so a neighbour never covers them
  const dot = (code: string, where: 'main' | 'inset') => {
    const geo = THAI_MAP[code]
    const p = where === 'inset' ? inset.at(geo.cx, geo.cy) : { x: geo.cx, y: geo.cy }
    return (
      <g key={`dot-${where}-${code}`} className="agy-geomap__live" aria-hidden="true">
        <circle cx={p.x} cy={p.y} r={7} className="agy-geomap__ring" />
        <circle cx={p.x} cy={p.y} r={4.5} className="agy-geomap__dot" />
      </g>
    )
  }
  const liveCodes = live.map((i) => i.code)

  return (
    <div className="agy-geomap">
      <div className="agy-geomap__map">
        <svg viewBox={THAI_MAP_VIEWBOX} role="img" aria-label={`แผนที่การเข้าชมรายจังหวัด ${periodText}`} onMouseLeave={() => setHover(null)}>
          {Object.keys(THAI_MAP).map((code) => province(code, 'main'))}
          {/* the inset's area, outlined on the main map */}
          <rect
            className="agy-geomap__inset-mark"
            x={-inset.ox / inset.k + INSET_BOX.x / inset.k}
            y={-inset.oy / inset.k + (INSET_BOX.y + 26) / inset.k}
            width={INSET_BOX.w / inset.k}
            height={(INSET_BOX.h - 26) / inset.k}
          />
          <g className="agy-geomap__inset">
            <rect x={INSET_BOX.x} y={INSET_BOX.y} width={INSET_BOX.w} height={INSET_BOX.h} rx={12} className="agy-geomap__inset-bg" />
            <text x={INSET_BOX.x + 12} y={INSET_BOX.y + 19} className="agy-geomap__inset-title">กรุงเทพฯ และปริมณฑล (ขยาย)</text>
            <clipPath id="agy-geomap-clip">
              <rect x={INSET_BOX.x} y={INSET_BOX.y + 26} width={INSET_BOX.w} height={INSET_BOX.h - 26} rx={10} />
            </clipPath>
            <g clipPath="url(#agy-geomap-clip)">
              <g transform={`translate(${inset.ox} ${inset.oy}) scale(${inset.k})`}>
                {/* neighbours first (faint, for context), then the inset's own provinces */}
                {Object.keys(THAI_MAP)
                  .filter((c) => !INSET_CODES.includes(c))
                  .map((c) => (
                    <path key={c} d={THAI_MAP[c].d} className="agy-geomap__shape is-context" vectorEffect="non-scaling-stroke" />
                  ))}
                {INSET_CODES.map((c) => province(c, 'inset'))}
              </g>
            </g>
          </g>
          {liveCodes.map((c) => dot(c, 'main'))}
          {liveCodes.filter((c) => INSET_CODES.includes(c)).map((c) => dot(c, 'inset'))}
        </svg>
        {shown && hover && (
          <div className="agy-geomap__tip" style={{ left: `${(hover.x / VBW) * 100}%`, top: `${(hover.y / VBH) * 100}%` }} role="status">
            <strong>{shown.nameTh}</strong>
            <span>
              {n(shown.views)} ครั้ง <small>({periodText})</small>
            </span>
            <span className={isLive(shown) ? 'is-live' : undefined}>
              {shown.ago === null ? 'วันนี้ยังไม่มีผู้เข้าชม' : `เข้าชมล่าสุด ${agoText(shown.ago)}`}
            </span>
          </div>
        )}
        <p className="agy-geomap__credit">ขอบเขตจังหวัด: © ผู้ร่วมพัฒนา OpenStreetMap (ODbL) ผ่าน geoBoundaries</p>
      </div>

      <div className="agy-geomap__side">
        <div className="agy-geomap__legend">
          <span className="agy-geomap__legend-title">จำนวนการเข้าชม ({periodText})</span>
          <span className="agy-geomap__key">
            <i style={{ background: NONE }} /> ไม่มี
          </span>
          {steps.map((s) => (
            <span className="agy-geomap__key" key={s.color}>
              <i style={{ background: s.color }} /> {s.from === s.to ? n(s.from) : `${n(s.from)}–${n(s.to)}`}
            </span>
          ))}
          <span className="agy-geomap__key">
            <i className="is-live" /> มีผู้เข้าชมใน {LIVE_MINUTES} นาที
          </span>
        </div>

        <h3>กำลังมีผู้เข้าชม ({LIVE_MINUTES} นาทีล่าสุด)</h3>
        {live.length === 0 ? (
          <p className="agy__sub">ยังไม่มี</p>
        ) : (
          <ul className="agy-geomap__list">
            {live.map((i) => (
              <li key={i.code}>
                <span className="agy-geomap__pulse-dot" aria-hidden="true" />
                <a href={i.href}>{i.nameTh}</a>
                <small>{agoText(i.ago ?? 0)}</small>
              </li>
            ))}
          </ul>
        )}

        <h3>เข้าชมมากที่สุด</h3>
        {top.length === 0 ? (
          <p className="agy__sub">ยังไม่มีการเข้าชมในช่วงนี้</p>
        ) : (
          <ol className="agy-geomap__list agy-geomap__list--rank">
            {top.map((i) => (
              <li key={i.code}>
                <a href={i.href}>{i.nameTh}</a>
                <strong>{n(i.views)}</strong>
              </li>
            ))}
          </ol>
        )}
        <p className="agy-geomap__note">อัปเดตอัตโนมัติทุก 1 นาที · ล่าสุด {updatedAt} น.</p>
      </div>
    </div>
  )
}
