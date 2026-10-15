'use client'

import { useAuth } from '@payloadcms/ui'
import React from 'react'

const COLORS = ['#0f5c8c', '#1f7a4d', '#6b3fa0', '#a3342f', '#b45309', '#0e7490', '#9d174d', '#3f4c6b']
const TITLES = /^(นางสาว|นาย|นาง|น\.ส\.|ดร\.|ว่าที่\s*ร\.ต\.)\s*/
const LEADING_VOWEL = /^[เแโใไ]/

/** First letter of the name, skipping a title (นาย, นางสาว ...) and a Thai leading vowel (เ แ โ ใ ไ). */
export function initialOf(name: string): string {
  const n = name.trim().replace(TITLES, '').replace(LEADING_VOWEL, '')
  const first = [...new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(n)][0]?.segment ?? ''
  // keep the consonant only (drop vowel and tone marks written above or below it)
  return first.normalize('NFC').charAt(0).toUpperCase() || '?'
}

/** Profile picture in the top bar: a coloured circle with the first letter of the signed-in person's name. */
export function Avatar() {
  const { user } = useAuth<{ id: number; name?: string; username?: string }>()
  const name = user?.name || user?.username || ''
  const color = COLORS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length]
  return (
    <span className="agy-avatar" style={{ background: color }} title={name} aria-hidden="true">
      {initialOf(name)}
    </span>
  )
}
