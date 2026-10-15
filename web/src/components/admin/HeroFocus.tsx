'use client'

import { useField, useFormFields } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))

/**
 * Pick the point of the header picture that must stay in view. The header is cropped differently
 * on phones and wide screens; the three frames show the result for each.
 */
export function HeroFocus() {
  const { value: x, setValue: setX } = useField<number>({ path: 'heroFocusX' })
  const { value: y, setValue: setY } = useField<number>({ path: 'heroFocusY' })
  const heroId = useFormFields(([f]) => f.heroImage?.value) as number | { id: number } | null | undefined
  const id = heroId && typeof heroId === 'object' ? heroId.id : heroId
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return setUrl(null)
    let live = true
    fetch(`/api/files/${id}?depth=0`, { credentials: 'include' })
      .then((r) => r.json())
      .then((f) => live && setUrl(f.url ?? null))
      .catch(() => live && setUrl(null))
    return () => {
      live = false
    }
  }, [id])

  if (!url) return null
  const fx = clamp(x ?? 50)
  const fy = clamp(y ?? 40)
  const set = (nx: number, ny: number) => {
    setX(clamp(nx))
    setY(clamp(ny))
  }
  const pick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    set(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100)
  }
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2
    const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const d = move[e.key]
    if (!d) return
    e.preventDefault()
    set(fx + d[0], fy + d[1])
  }
  const frame = (label: string, ratio: string) => (
    <figure>
      <div style={{ aspectRatio: ratio, backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: `${fx}% ${fy}%` }} />
      <figcaption>{label}</figcaption>
    </figure>
  )

  return (
    <div className="agy agy-focus field-type">
      <div className="agy-files__label">จุดเด่นของภาพ</div>
      <p className="agy__sub">กดบนภาพตรงส่วนที่ต้องเห็นเสมอ (หรือใช้ปุ่มลูกศรเมื่อเลือกภาพอยู่) ระบบจะครอบภาพรอบจุดนี้ในแต่ละขนาดจอ มีผลเมื่อกดบันทึก</p>
      <button type="button" className="agy-focus__pick" onClick={pick} onKeyDown={onKey} aria-label={`เลือกจุดเด่นของภาพ ตำแหน่งปัจจุบัน แนวนอน ${fx}% แนวตั้ง ${fy}%`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" />
        <span className="agy-focus__dot" style={{ left: `${fx}%`, top: `${fy}%` }} aria-hidden="true" />
      </button>
      <div className="agy-focus__frames" aria-hidden="true">
        {frame('จอคอมพิวเตอร์', '12 / 4')}
        {frame('แท็บเล็ต', '12 / 6')}
        {frame('โทรศัพท์', '4 / 5')}
      </div>
      <p className="agy__sub">
        ตำแหน่ง: แนวนอน {fx}% · แนวตั้ง {fy}%{' '}
        <button type="button" className="agy__btn agy__btn--small" onClick={() => set(50, 40)}>
          กลับค่าเริ่มต้น
        </button>
      </p>
    </div>
  )
}
