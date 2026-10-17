'use client'

import { useRowLabel } from '@payloadcms/ui'
import React from 'react'

/** A row of the link list labelled by what it shows on the page ("01 คู่มือการใช้งาน…"), not "แถว 01". */
export function LinkRowLabel() {
  const { data, rowNumber } = useRowLabel<{ title?: string; url?: string; file?: unknown }>()
  const n = String((rowNumber ?? 0) + 1).padStart(2, '0')
  const kind = data?.file ? 'ไฟล์' : data?.url ? 'ลิงก์' : 'ยังไม่มีลิงก์หรือไฟล์'
  return (
    <span className="agy-linkrow">
      <strong>{n}</strong> {data?.title?.trim() || '(ยังไม่มีข้อความ)'} <em>· {kind}</em>
    </span>
  )
}
