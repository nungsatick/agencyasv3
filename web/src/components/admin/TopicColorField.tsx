'use client'

import { FieldLabel, useField, useFormFields } from '@payloadcms/ui'
import type { SelectFieldClientComponent } from 'payload'
import React from 'react'

import { topicColor, topicPalette } from '@/lib/themes'

/**
 * Colour of a topic picked from swatches instead of a drop-down of colour names.
 * Each swatch shows the colour itself; below them a sample tag shows how the topic looks on the public pages.
 */
export const TopicColorField: SelectFieldClientComponent = ({ field, path }) => {
  const { value, setValue } = useField<string | null>({ path })
  const slug = useFormFields(([fields]) => fields.slug?.value as string | undefined)
  const name = useFormFields(([fields]) => fields.nameTh?.value as string | undefined)
  const current = topicColor({ slug, color: value })
  const fallback = topicColor({ slug, color: null })

  const Swatch = ({ id, label, dot, bg, text }: { id: string; label: string; dot: string; bg: string; text: string }) => {
    const on = (value ?? '') === id
    return (
      <button type="button" role="radio" aria-checked={on} title={label} className={`agy-color__opt${on ? ' is-on' : ''}`} onClick={() => setValue(id || null)}>
        {/* the colour itself, on its light tint as used for tags on the public pages */}
        <span className="agy-color__chip" style={{ background: dot, borderColor: bg, color: text }} />
        <span className="agy-color__name">{label}</span>
      </button>
    )
  }

  return (
    <div className="field-type agy-color">
      <FieldLabel label={field.label} path={path} />
      <div className="agy-color__grid" role="radiogroup" aria-label="สีของประเด็น">
        <Swatch id="" dot={fallback.dot} bg={fallback.bg} text={fallback.text} label={`สีเดิม (${fallback.label})`} />
        {Object.entries(topicPalette).map(([id, t]) => (
          <Swatch key={id} id={id} {...t} />
        ))}
      </div>
      <div className="agy-color__preview">
        ตัวอย่างบนหน้าเว็บ:{' '}
        <span className="agy-color__tag" style={{ background: current.bg, color: current.text }}>
          <span className="agy-color__dot" style={{ background: current.dot }} />
          {name || 'ชื่อประเด็น'}
        </span>
      </div>
    </div>
  )
}
