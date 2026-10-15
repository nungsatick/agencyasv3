'use client'

import { useAuth } from '@payloadcms/ui'
import { useCallback, useEffect, useRef, useState } from 'react'

const IDLE_MS = 30 * 60 * 1000 // same as IDLE_MINUTES in lib/idle.ts
const WARN_MS = 2 * 60 * 1000 // warning shown this long before the end
const PING_EVERY = 60 * 1000 // report activity to the server at most this often
const KEY = 'agy_last_active' // shared by every open backoffice tab
const EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'scroll', 'touchstart'] as const

const readLast = () => {
  try {
    return Number(window.localStorage.getItem(KEY)) || Date.now()
  } catch {
    return Date.now()
  }
}

/**
 * Signs the person out after 30 minutes without clicking, typing or scrolling in any backoffice tab.
 * Two minutes before, a box counts down with a "ใช้งานต่อ" button. Real activity is reported to the
 * server about once a minute; the server ends the session by itself too, so this is not only cosmetic.
 */
export function IdleGuard() {
  const { user } = useAuth()
  const [left, setLeft] = useState<number | null>(null) // ms left while the warning shows
  const lastPing = useRef(0)
  const lastMark = useRef(0)

  const ping = useCallback(() => {
    lastPing.current = Date.now()
    void fetch('/api/users/activity', { method: 'POST', credentials: 'include' }).catch(() => undefined)
  }, [])

  const mark = useCallback(() => {
    const now = Date.now()
    if (now - lastMark.current < 5000) return
    lastMark.current = now
    try {
      window.localStorage.setItem(KEY, String(now))
    } catch {
      /* this tab still counts */
    }
    if (now - lastPing.current >= PING_EVERY) ping()
  }, [ping])

  const signOut = useCallback(async () => {
    await fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined)
    window.location.href = '/login?reason=idle'
  }, [])

  useEffect(() => {
    if (!user) return
    try {
      window.localStorage.setItem(KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
    ping()
    for (const e of EVENTS) window.addEventListener(e, mark, { passive: true })
    const tick = window.setInterval(() => {
      const idle = Date.now() - readLast()
      if (idle >= IDLE_MS) return void signOut()
      setLeft(idle >= IDLE_MS - WARN_MS ? IDLE_MS - idle : null)
    }, 1000)
    return () => {
      for (const e of EVENTS) window.removeEventListener(e, mark)
      window.clearInterval(tick)
    }
  }, [user, mark, ping, signOut])

  if (!user || left === null) return null
  const s = Math.max(0, Math.ceil(left / 1000))
  return (
    <div className="agy-confirm agy-idle" role="presentation">
      <div className="agy-confirm__box" role="alertdialog" aria-modal="true" aria-labelledby="agy-idle-title" aria-describedby="agy-idle-text">
        <h2 id="agy-idle-title">ยังใช้งานอยู่หรือไม่?</h2>
        <div className="agy-confirm__body">
          <p id="agy-idle-text">
            ไม่มีการใช้งานมาเกือบ 30 นาที ระบบจะออกจากระบบให้อัตโนมัติใน{' '}
            <strong className="agy-idle__count">
              {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
            </strong>{' '}
            นาที งานที่ยังไม่ได้บันทึกจะหายไป
          </p>
        </div>
        <div className="agy-confirm__actions">
          <button type="button" className="agy__btn" onClick={() => void signOut()}>
            ออกจากระบบ
          </button>
          <button
            type="button"
            className="agy__btn agy__btn--primary"
            autoFocus
            onClick={() => {
              lastMark.current = 0
              mark()
              ping()
              setLeft(null)
            }}
          >
            ใช้งานต่อ
          </button>
        </div>
      </div>
    </div>
  )
}
