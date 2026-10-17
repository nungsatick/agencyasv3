'use client'

import { useField } from '@payloadcms/ui'
import React from 'react'

import { currentFiscalYear } from '@/lib/fiscalYear'

/**
 * "ปีงบประมาณ" of a central-content topic as a drop-down instead of a number box: the years since the
 * project started up to next year, plus "ทุกปี" (no year: the topic shows whatever year a visitor picks).
 */
export function YearField({ path }: { path: string }) {
  const { value, setValue } = useField<number | null>({ path })
  const last = currentFiscalYear() + 1
  const years = Array.from({ length: last - 2565 + 1 }, (_, i) => last - i)
  if (value && !years.includes(value)) years.push(value)
  return (
    <div className="field-type agy-year-field">
      <label className="field-label" htmlFor={`field-${path}`}>
        ปีงบประมาณ
      </label>
      <select id={`field-${path}`} value={value ?? ''} onChange={(e) => setValue(e.target.value ? Number(e.target.value) : null)}>
        <option value="">ทุกปี (แสดงเสมอ)</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  )
}
