import Link from 'next/link'
import React from 'react'

// stroke icons on a 24px grid (same drawing style as the sidebar icons in custom.scss)
const ICONS = {
  doc: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  map: <><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  draft: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13 7l4 4" /></>,
  review: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5M8.5 11l2 2 3.5-4" /></>,
  shield: <><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z" /><path d="M12 9v4M12 16h.01" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  inbox: <><path d="M3 13l3-8h12l3 8v6H3z" /><path d="M3 13h5l1 2h6l1-2h5" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  tag: <><path d="M4 4h7l9 9-7 7-9-9z" /><circle cx="8.5" cy="8.5" r="1.2" /></>,
} as const

export type TileIcon = keyof typeof ICONS
/** brand: plain count · warn: something to deal with · ok: a to-do count that is down to zero */
export type TileTone = 'brand' | 'warn' | 'ok'

/**
 * One summary card on the overview and report pages: icon, label, the number, and an optional
 * line under it (what the number covers, or where the card leads) and progress bar ("76 of 76").
 * Cards with a link lift on hover and show an arrow.
 */
export function Tile({
  label,
  value,
  icon,
  tone = 'brand',
  hint,
  href,
  of,
}: {
  label: string
  value: number
  icon: TileIcon
  tone?: TileTone
  hint?: React.ReactNode
  href?: string
  /** draws a bar for value / of */
  of?: number
}) {
  const body = (
    <>
      <span className="agy__tile-top">
        <span className="agy__tile-ic" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {ICONS[icon]}
          </svg>
        </span>
        <span className="agy__tile-label">{label}</span>
        {href && (
          <svg className="agy__tile-go" aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17L17 7M9 7h8v8" />
          </svg>
        )}
      </span>
      <strong className="agy__tile-value">
        {value.toLocaleString('th-TH')}
        {of !== undefined && <small> / {of.toLocaleString('th-TH')}</small>}
      </strong>
      {of !== undefined && of > 0 && (
        <span className="agy__tile-bar" aria-hidden="true">
          <i style={{ width: `${Math.min(100, Math.round((value / of) * 100))}%` }} />
        </span>
      )}
      {hint && <span className="agy__tile-hint">{hint}</span>}
    </>
  )
  const className = `agy__tile agy__tile--${tone}${href ? ' agy__tile--link' : ''}`
  return href ? (
    <Link className={className} href={href}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

/** For counts of things to deal with: orange while there are some, green at zero. */
export const todo = (n: number): TileTone => (n ? 'warn' : 'ok')
