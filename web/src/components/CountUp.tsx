'use client'

import { useEffect, useRef } from 'react'

/** Keep the real value available to screen readers and reserve its full width. */
export function CountUp({ value }: { value: number }) {
  const number = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = number.current
    if (!el) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    el.textContent = String(value)
    if (motion.matches || value <= 0 || !('IntersectionObserver' in window)) return

    let frame = 0
    let started = false
    let start: number | undefined
    const tick = (now: number) => {
      start ??= now
      const progress = Math.min((now - start) / 1200, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      el.textContent = String(progress === 1 ? value : Math.floor(value * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver((entries) => {
      if (started || !entries.some((entry) => entry.isIntersecting)) return
      started = true
      observer.disconnect()
      el.textContent = '0'
      frame = requestAnimationFrame(tick)
    }, { threshold: 0.5 })
    observer.observe(el)

    const finish = () => {
      if (!motion.matches) return
      observer.disconnect()
      cancelAnimationFrame(frame)
      el.textContent = String(value)
    }
    motion.addEventListener('change', finish)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      motion.removeEventListener('change', finish)
    }
  }, [value])

  return (
    <span style={{ display: 'inline-grid', fontVariantNumeric: 'tabular-nums' }}>
      <span style={{ gridArea: '1 / 1', opacity: 0 }}>{value}</span>
      <span ref={number} aria-hidden="true" style={{ gridArea: '1 / 1' }}>{value}</span>
    </span>
  )
}
