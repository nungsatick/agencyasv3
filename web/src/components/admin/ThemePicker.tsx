'use client'

import { useField, useFormFields } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

import { themes, type ThemeCode } from '@/lib/themes'

/** Theme choice as colour swatches with a live miniature of the province page. */
export function ThemePicker({ path }: { path: string }) {
  const { value, setValue } = useField<ThemeCode>({ path })
  const name = useFormFields(([f]) => f.nameTh?.value) as string | undefined
  const code = useFormFields(([f]) => f.code?.value) as string | undefined
  const side = (useFormFields(([f]) => f.heroTextSide?.value) as string | undefined) ?? 'left'
  const heroId = useFormFields(([f]) => f.heroImage?.value) as number | { id: number } | null | undefined
  const [heroUrl, setHeroUrl] = useState<string | null>(null)

  const id = heroId && typeof heroId === 'object' ? heroId.id : heroId
  useEffect(() => {
    if (!id) return setHeroUrl(null)
    let live = true
    fetch(`/api/files/${id}?depth=0`, { credentials: 'include' })
      .then((r) => r.json())
      .then((f) => live && setHeroUrl(f.url ?? null))
      .catch(() => live && setHeroUrl(null))
    return () => {
      live = false
    }
  }, [id])

  const current = themes[value ?? 'ocean'] ?? themes.ocean
  const dir = side === 'right' ? '270deg' : '90deg'
  const heroBg = heroUrl
    ? `linear-gradient(${dir}, ${current.deep}f0 0%, ${current.deep}cc 42%, ${current.deep}26 76%, transparent 100%), url(${heroUrl}) center 40% / cover`
    : current.dark

  return (
    <div className="agy agy-theme field-type">
      <div className="agy-files__label">ธีมสี</div>
      <p className="agy__sub">เลือกจากชุดสีที่ตรวจแล้วว่าตัวหนังสืออ่านออกทุกหน้า มีผลเมื่อกดบันทึก</p>
      <div className="agy-theme__grid" role="radiogroup" aria-label="ธีมสี">
        {(Object.keys(themes) as ThemeCode[]).map((k) => {
          const t = themes[k]
          const on = k === (value ?? 'ocean')
          return (
            <button type="button" key={k} role="radio" aria-checked={on} className={on ? 'agy-theme__opt is-on' : 'agy-theme__opt'} style={on ? { borderColor: t.dark, background: t.tint } : undefined} onClick={() => setValue(k)}>
              <span className="agy-theme__swatch" aria-hidden="true">
                <i style={{ background: t.deep }} />
                <i style={{ background: t.dark }} />
                <i style={{ background: t.primary }} />
                <i style={{ background: t.tint }} />
              </span>
              <span>
                {t.label}
                {on && <small style={{ color: t.dark }}>ใช้อยู่</small>}
              </span>
            </button>
          )
        })}
      </div>

      <div className="agy-files__label" style={{ marginTop: 20 }}>ตัวอย่างหน้าเว็บ</div>
      <div className="agy-theme__preview" aria-hidden="true">
        <div className="agy-theme__bar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {code && <img src={`/logos/${code}.png`} alt="" />}
          <div>
            <strong>ระบบสนับสนุนการจัดทำบัญชีข้อมูล</strong>
            <span>จังหวัด{name}</span>
          </div>
          <em style={{ background: current.tint, color: current.dark }}>หน้าหลัก</em>
        </div>
        <div className={side === 'right' ? 'agy-theme__hero agy-theme__hero--right' : 'agy-theme__hero'} style={{ background: heroBg, textAlign: side === 'right' ? 'right' : 'left' }}>
          <strong>บัญชีข้อมูลจังหวัด{name}</strong>
          <span style={{ color: current.dark }}>ค้นหาชุดข้อมูลในระบบบัญชีข้อมูล</span>
        </div>
        <div className="agy-theme__body">
          <span style={{ color: current.dark }}>18</span>
          <span style={{ color: current.primary }}>ดูทั้งหมด</span>
          <span style={{ background: current.dark }}>2569</span>
        </div>
        <div className="agy-theme__foot" style={{ background: current.deep }}>ส่วนท้ายของหน้าเว็บ</div>
      </div>
    </div>
  )
}
