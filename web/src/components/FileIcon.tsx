import React from 'react'

import { fileType } from '@/lib/data'
import type { File as FileDoc } from '@/payload-types'

/**
 * Picture of a file's type (PDF, XLSX, JPG ...) wherever a page says what kind of file something is.
 * Falls back to the short type name when there is no picture for it. `withLabel` adds the name beside it.
 */
export function FileIcon({ file, size = 36, withLabel = false }: { file: Pick<FileDoc, 'filename' | 'originalName' | 'mimeType'>; size?: number; withLabel?: boolean }) {
  const t = fileType(file)
  if (!t.icon) return <span className="ficon ficon--text">{t.label}</span>
  return (
    <span className="ficon" title={`ไฟล์ ${t.label}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={t.icon} alt={withLabel ? '' : `ไฟล์ ${t.label}`} width={Math.round(size * 0.79)} height={size} />
      {withLabel && <span className="ficon__label">{t.label}</span>}
    </span>
  )
}
