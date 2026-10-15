'use client'

import { FieldDescription, FieldError, FieldLabel, useField } from '@payloadcms/ui'
import type { UploadFieldClientComponent } from 'payload'
import React, { useEffect, useRef, useState } from 'react'

type FileDoc = { id: number; url?: string | null; originalName?: string | null; filename?: string | null; width?: number | null; height?: number | null }

const idOf = (v: unknown): number | null => (v == null || v === '' ? null : typeof v === 'object' ? ((v as { id?: number }).id ?? null) : Number(v))

/** A pasted picture has no useful name ("image.png"): name it by the time it was pasted. */
const named = (f: File) => {
  if (f.name && f.name !== 'image.png' && f.name !== 'image.jpeg') return f
  const ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
  const t = new Date()
  const stamp = `${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, '0')}${String(t.getDate()).padStart(2, '0')}-${String(t.getHours()).padStart(2, '0')}${String(t.getMinutes()).padStart(2, '0')}${String(t.getSeconds()).padStart(2, '0')}`
  return new File([f], `paste-${stamp}.${ext}`, { type: f.type })
}

/**
 * Picture field (announcement image, province header image, dashboard cover): pick a picture from the
 * computer, paste one from the clipboard (Ctrl+V on the field, or the "วางจากคลิปบอร์ด" button), or drop
 * a file on it; see it at once, change or remove it. Replaces Payload's upload drawer, which shows the
 * file library's technical fields (public path, sha256 ...) and confused people.
 */
export const ImageField: UploadFieldClientComponent = ({ field, path, readOnly }) => {
  const { value, setValue, showError } = useField<number | { id: number } | null>({ path })
  const [file, setFile] = useState<FileDoc | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const id = idOf(value)
  const label = typeof field.label === 'string' ? field.label : field.name
  const description = (field.admin as { description?: string } | undefined)?.description

  // show the picture that is attached now
  useEffect(() => {
    if (!id) return setFile(null)
    if (file?.id === id) return
    let gone = false
    fetch(`/api/files/${id}?depth=0`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !gone && setFile(d))
      .catch(() => !gone && setFile(null))
    return () => {
      gone = true
    }
  }, [id, file?.id])

  const upload = async (picked: File) => {
    setError(null)
    if (!picked.type.startsWith('image/')) return setError('เลือกไฟล์รูปภาพ (JPG, PNG, GIF หรือ WebP)')
    if (picked.size > 10 * 1024 * 1024) return setError('ไฟล์ใหญ่เกิน 10 MB ลดขนาดภาพก่อนแล้วลองใหม่')
    setBusy(true)
    const data = new FormData()
    data.set('file', named(picked))
    data.set('_payload', JSON.stringify({}))
    const r = await fetch('/api/files', { method: 'POST', credentials: 'include', body: data }).catch(() => null)
    const body = r ? await r.json().catch(() => ({})) : {}
    setBusy(false)
    if (!r?.ok || !body.doc) return setError(body.errors?.[0]?.message ?? 'อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง')
    setFile(body.doc)
    setValue(body.doc.id)
  }

  // Ctrl+V while the field has focus
  const onPaste = (e: React.ClipboardEvent) => {
    if (readOnly || busy) return
    const f = [...e.clipboardData.items].find((i) => i.kind === 'file' && i.type.startsWith('image/'))?.getAsFile()
    if (!f) return setError('ในคลิปบอร์ดไม่มีรูปภาพ คัดลอกภาพก่อน (เช่น คลิกขวาที่ภาพ › คัดลอกรูปภาพ หรือแคปหน้าจอ) แล้ววางอีกครั้ง')
    e.preventDefault()
    void upload(f)
  }
  // the button: read the clipboard directly (the browser may ask for permission once)
  const pasteFromClipboard = async () => {
    setError(null)
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith('image/'))
        if (type) return void upload(new File([await item.getType(type)], 'image.png', { type }))
      }
      setError('ในคลิปบอร์ดไม่มีรูปภาพ คัดลอกภาพก่อน (เช่น คลิกขวาที่ภาพ › คัดลอกรูปภาพ หรือแคปหน้าจอ) แล้วกดอีกครั้ง')
    } catch {
      setError('เบราว์เซอร์ไม่อนุญาตให้อ่านคลิปบอร์ด ให้คลิกที่กรอบภาพแล้วกด Ctrl+V แทน')
    }
  }
  const drop = {
    onDragOver: (e: React.DragEvent) => {
      if (readOnly) return
      e.preventDefault()
      setOver(true)
    },
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setOver(false)
      const f = e.dataTransfer.files?.[0]
      if (f && !readOnly && !busy) void upload(f)
    },
  }
  const pasteButton = !readOnly && (
    <button type="button" className="agy__btn agy__btn--small" disabled={busy} onClick={() => void pasteFromClipboard()}>
      วางจากคลิปบอร์ด
    </button>
  )

  return (
    <div className={`field-type agy-img${showError ? ' error' : ''}${over ? ' agy-img--over' : ''}`} onPaste={onPaste} {...drop}>
      {/* clicking the frame focuses it, so Ctrl+V lands here */}
      <FieldLabel label={label} path={path} required={field.required} />
      <FieldError path={path} showError={showError} />
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void upload(f)
        }}
      />
      {id && file?.url ? (
        <div className="agy-img__box" tabIndex={readOnly ? undefined : 0} aria-label="ภาพที่เลือก: กด Ctrl+V เพื่อวางภาพใหม่จากคลิปบอร์ด">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={file.url} alt="" className="agy-img__preview" />
          <div className="agy-img__meta">
            <span className="agy-img__name">{file.originalName || file.filename}</span>
            {file.width && file.height ? <span>{`${file.width} × ${file.height} พิกเซล`}</span> : null}
            {!readOnly && (
              <span className="agy-img__actions">
                <button type="button" className="agy__btn agy__btn--small" disabled={busy} onClick={() => input.current?.click()}>
                  {busy ? 'กำลังอัปโหลด…' : 'เปลี่ยนภาพ'}
                </button>
                {pasteButton}
                <button type="button" className="agy__btn agy__btn--small agy__btn--trash" disabled={busy} onClick={() => setValue(null)}>
                  นำภาพออก
                </button>
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="agy-img__empty" tabIndex={readOnly ? undefined : 0} aria-label="กรอบภาพ: กด Ctrl+V เพื่อวางภาพจากคลิปบอร์ด">
          {busy ? (
            <span>กำลังอัปโหลด…</span>
          ) : id ? (
            <span>กำลังโหลดภาพ…</span>
          ) : (
            <>
              <span className="agy-img__choices">
                <button type="button" className="agy__btn agy__btn--small agy__btn--primary" disabled={readOnly} onClick={() => input.current?.click()}>
                  + เลือกภาพจากเครื่อง
                </button>
                {pasteButton}
              </span>
              {!readOnly && <span className="agy-img__hint">หรือคลิกในกรอบนี้แล้วกด Ctrl+V เพื่อวางภาพ หรือลากไฟล์ภาพมาวาง</span>}
            </>
          )}
        </div>
      )}
      {error && <p className="agy-img__error">{error}</p>}
      {description && <FieldDescription description={description} path={path} />}
    </div>
  )
}
