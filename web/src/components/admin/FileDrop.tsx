'use client'

import React, { useRef, useState } from 'react'

/**
 * The backoffice's one file drop area (custom.scss .agy-drop; Payload's own upload boxes are styled to match):
 * an upload mark, a "choose" button and a line on what is accepted. Click to pick, or drag files onto it.
 * `compact` for a smaller box inside a panel.
 */
export function FileDrop({
  accept,
  multiple = false,
  busy = false,
  label,
  hint,
  picked,
  compact = false,
  onFiles,
}: {
  accept: string
  multiple?: boolean
  busy?: boolean
  label: string
  hint: string
  /** what has been chosen so far, shown under the button */
  picked?: string | null
  compact?: boolean
  onFiles: (files: File[]) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const take = (list: FileList | null) => {
    const files = [...(list ?? [])]
    if (files.length) onFiles(multiple ? files : files.slice(0, 1))
  }
  return (
    <div
      className={`agy-drop${compact ? ' agy-drop--compact' : ''}${over ? ' is-over' : ''}${busy ? ' is-busy' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        if (!busy) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        if (!busy) take(e.dataTransfer.files)
      }}
    >
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          take(e.target.files)
          e.target.value = ''
        }}
      />
      <button type="button" className="agy-drop__button" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'กำลังอัปโหลด…' : label}
      </button>
      <span className="agy-drop__hint">หรือลากไฟล์มาวางในกรอบนี้ · {hint}</span>
      {picked && <span className="agy-drop__picked">{picked}</span>}
    </div>
  )
}
