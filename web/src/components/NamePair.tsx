'use client'

import React from 'react'

import type { NameParts } from '@/lib/nameParts'

/**
 * Two boxes side by side for one name: ชื่อ (with any title) and นามสกุล. The form keeps the two parts and
 * stores them joined (lib/nameParts.ts). Used by the public account request form and the backoffice.
 */
export function NamePair({ value, onChange, onBlur, invalid, describedBy, english, dataField, className }: {
  value: NameParts
  onChange: (v: NameParts) => void
  onBlur?: () => void
  invalid?: boolean
  describedBy?: string
  english?: boolean
  dataField?: string
  className?: string
}) {
  const box = (part: 'first' | 'last') => ({
    value: value[part],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [part]: e.target.value }),
    onBlur,
    'aria-invalid': invalid || undefined,
    'aria-describedby': describedBy,
    maxLength: 80,
    lang: english ? 'en' : undefined,
  })
  return (
    <div className={`name-pair ${className ?? ''}`}>
      <label className="name-pair__part">
        <span>{english ? 'First name' : 'ชื่อ'}</span>
        <input {...box('first')} data-field={dataField} autoComplete={english ? 'off' : 'given-name'} placeholder={english ? 'First name' : 'ชื่อจริง'} />
      </label>
      <label className="name-pair__part">
        <span>{english ? 'Last name' : 'นามสกุล'}</span>
        <input {...box('last')} autoComplete={english ? 'off' : 'family-name'} placeholder={english ? 'Last name' : 'นามสกุล'} />
      </label>
    </div>
  )
}
