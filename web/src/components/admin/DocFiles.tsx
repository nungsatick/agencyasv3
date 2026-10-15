'use client'

import { toast, useField } from '@payloadcms/ui'
import React, { useCallback, useEffect, useRef, useState } from 'react'

type FileDoc = {
  id: number
  filename?: string
  originalName?: string
  mimeType?: string
  filesize?: number
  publicPath?: string
  url?: string
  versionNo?: number
  changeNote?: string
  updatedAt?: string
  uploadedBy?: { name?: string } | number | null
}

const kind = (m = '') => (m === 'application/pdf' ? 'PDF' : m.startsWith('image/') ? 'รูปภาพ' : m.includes('sheet') || m.includes('excel') ? 'Excel' : 'ไฟล์')
const size = (n = 0) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '')
const who = (u: FileDoc['uploadedBy']) => (u && typeof u === 'object' && u.name ? u.name : '')
const publicUrl = (f: FileDoc) => (f.publicPath ? '/' + f.publicPath.split('/').map(encodeURIComponent).join('/') : (f.url ?? '#'))
const ACCEPT = '.pdf,.xlsx,.xls,image/*'

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { credentials: 'include', ...init })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.errors?.[0]?.message ?? body.error ?? 'ทำรายการไม่สำเร็จ')
  return body
}

/** Upload bytes to the files collection (new file, or a replacement when `id` is given). */
function sendFile(file: File, id?: number, changeNote?: string) {
  const data = new FormData()
  data.set('file', file)
  data.set('_payload', JSON.stringify(changeNote ? { changeNote } : {}))
  return api(id ? `/api/files/${id}` : '/api/files', { method: id ? 'PATCH' : 'POST', body: data })
}

function FileRow({ file, onChanged, onDetach }: { file: FileDoc; onChanged: () => void; onDetach: () => void }) {
  const [open, setOpen] = useState<'replace' | 'history' | null>(null)
  const [history, setHistory] = useState<FileDoc[] | null>(null)
  const [next, setNext] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const pick = useRef<HTMLInputElement>(null)

  const loadHistory = useCallback(async () => {
    const res = await api(`/api/files?where[versionOf][equals]=${file.id}&sort=-versionNo&depth=1&limit=50`)
    setHistory(res.docs)
  }, [file.id])

  useEffect(() => {
    if (open === 'history') void loadHistory().catch((e) => toast.error(e.message))
  }, [open, loadHistory, file.versionNo])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ทำรายการไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const replace = () =>
    run(async () => {
      if (!next) return
      await sendFile(next, file.id, note.trim() || undefined)
      toast.success(`แทนที่ไฟล์แล้ว เป็นเวอร์ชัน ${(file.versionNo ?? 1) + 1}`)
      setNext(null)
      setNote('')
      setOpen('history')
      onChanged()
    })

  const restore = (h: FileDoc) =>
    run(async () => {
      const res = await api(`/api/files/${h.id}/restore`, { method: 'POST' })
      toast.success(`กู้คืนเวอร์ชัน ${h.versionNo} แล้ว เป็นเวอร์ชัน ${res.versionNo}`)
      onChanged()
    })

  const hasHistory = (file.versionNo ?? 1) > 1
  return (
    <div className="agy-file">
      <div className="agy-file__main">
        <span className={`agy-file__kind agy-file__kind--${kind(file.mimeType) === 'PDF' ? 'pdf' : 'other'}`}>{kind(file.mimeType)}</span>
        <div className="agy-file__info">
          <strong>{file.originalName ?? file.filename}</strong>
          <span>
            เวอร์ชัน {file.versionNo ?? 1} · {size(file.filesize)}
            {who(file.uploadedBy) && ` · อัปโหลดโดย ${who(file.uploadedBy)}`} · {when(file.updatedAt)}
          </span>
        </div>
        <a className="agy__btn" href={publicUrl(file)} target="_blank" rel="noopener noreferrer">เปิดดู</a>
        <button
          type="button"
          className="agy__btn"
          onClick={() => {
            void navigator.clipboard.writeText(window.location.origin + publicUrl(file))
            toast.success('คัดลอกลิงก์แล้ว')
          }}
        >
          คัดลอกลิงก์
        </button>
      </div>
      <div className="agy-file__actions">
        <button type="button" className={open === 'replace' ? 'agy__btn agy__btn--primary' : 'agy__btn'} onClick={() => setOpen(open === 'replace' ? null : 'replace')}>
          แทนที่ด้วยไฟล์ใหม่
        </button>
        <button type="button" className={open === 'history' ? 'agy__btn agy__btn--primary' : 'agy__btn'} onClick={() => setOpen(open === 'history' ? null : 'history')} disabled={!hasHistory}>
          {hasHistory ? `ประวัติไฟล์ (${(file.versionNo ?? 1) - 1} เวอร์ชันก่อนหน้า)` : 'ยังไม่มีเวอร์ชันก่อนหน้า'}
        </button>
        <button type="button" className="agy__btn agy-file__detach" onClick={onDetach}>นำออกจากเอกสารนี้</button>
      </div>

      {open === 'replace' && (
        <div className="agy-file__panel">
          <input ref={pick} type="file" accept={ACCEPT} hidden onChange={(e) => setNext(e.target.files?.[0] ?? null)} />
          <div className="agy__actions">
            <button type="button" className="agy__btn" onClick={() => pick.current?.click()}>{next ? 'เลือกไฟล์อื่น' : 'เลือกไฟล์ใหม่'}</button>
            {next && <span className="agy-file__picked">{next.name} · {size(next.size)}</span>}
          </div>
          <label className="agy__field">
            <span>เหตุผลที่แก้ไข</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น แก้คำผิดหน้า 3 หรือเพิ่มลายมือชื่อประธาน" />
          </label>
          <p className="agy__sub">ไฟล์เดิมจะถูกเก็บเป็นเวอร์ชัน {file.versionNo ?? 1} ในประวัติ ลิงก์ของไฟล์ไม่เปลี่ยน และจะเปิดไฟล์ใหม่นี้แทน มีผลทันทีโดยไม่ต้องกดบันทึกเอกสาร</p>
          <div className="agy__actions">
            <button type="button" className="agy__btn agy__btn--primary" disabled={!next || busy} onClick={replace}>
              {busy ? 'กำลังอัปโหลด...' : `แทนที่ไฟล์เป็นเวอร์ชัน ${(file.versionNo ?? 1) + 1}`}
            </button>
          </div>
        </div>
      )}

      {open === 'history' && (
        <ol className="agy-file__history">
          <li>
            <span className="agy-file__no agy-file__no--current">{file.versionNo ?? 1}</span>
            <div>
              <strong>เวอร์ชัน {file.versionNo ?? 1}</strong> <span className="agy__pill agy__pill--active">ใช้อยู่</span>
              <span className="agy-file__meta">{who(file.uploadedBy)} {when(file.updatedAt)}</span>
              {file.changeNote && <span>เหตุผล: {file.changeNote}</span>}
            </div>
          </li>
          {history === null && <li><span className="agy-file__no">…</span><div>กำลังโหลด</div></li>}
          {history?.map((h) => (
            <li key={h.id}>
              <span className="agy-file__no">{h.versionNo}</span>
              <div>
                <strong>เวอร์ชัน {h.versionNo}</strong>
                <span className="agy-file__meta">{who(h.uploadedBy)} {when(h.updatedAt)} · {size(h.filesize)}</span>
                {h.changeNote && <span>เหตุผล: {h.changeNote}</span>}
              </div>
              <a className="agy__btn" href={h.url} target="_blank" rel="noopener noreferrer">เปิดดู</a>
              <button type="button" className="agy__btn" disabled={busy} onClick={() => restore(h)}>กู้คืนเวอร์ชันนี้</button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** Replaces the plain relationship picker for a document's files: attach, replace, history, restore. */
export function DocFiles({ path }: { path: string }) {
  const { value, setValue } = useField<(number | { id: number })[]>({ path })
  const ids = (value ?? []).map((v) => (typeof v === 'object' ? v.id : v))
  const key = ids.join(',')
  const [files, setFiles] = useState<FileDoc[]>([])
  const [busy, setBusy] = useState(false)
  const pick = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!key) return setFiles([])
    const res = await api(`/api/files?where[id][in]=${key}&depth=1&limit=100`)
    const byId = new Map<number, FileDoc>(res.docs.map((d: FileDoc) => [d.id, d]))
    setFiles(key.split(',').map((id) => byId.get(Number(id))).filter(Boolean) as FileDoc[])
  }, [key])

  useEffect(() => {
    void load().catch((e) => toast.error(e.message))
  }, [load])

  const add = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = [...(e.target.files ?? [])]
    e.target.value = ''
    if (!chosen.length) return
    setBusy(true)
    try {
      const created: number[] = []
      for (const f of chosen) created.push((await sendFile(f)).doc.id)
      setValue([...ids, ...created])
      toast.success(`แนบไฟล์แล้ว ${created.length} ไฟล์ กดบันทึกเอกสารเพื่อยืนยัน`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="agy agy-files field-type">
      <div className="agy-files__label">ไฟล์แนบ</div>
      {files.length === 0 && <p className="agy__sub">ยังไม่มีไฟล์ เอกสารจะเผยแพร่ได้เมื่อมีไฟล์แนบหรือลิงก์ภายนอก</p>}
      {files.map((f) => (
        <FileRow key={f.id} file={f} onChanged={() => void load()} onDetach={() => setValue(ids.filter((id) => id !== f.id))} />
      ))}
      <input ref={pick} type="file" accept={ACCEPT} multiple hidden onChange={add} />
      <button type="button" className="agy-files__drop" disabled={busy} onClick={() => pick.current?.click()}>
        <strong>{busy ? 'กำลังอัปโหลด...' : files.length ? 'แนบไฟล์เพิ่ม' : 'เลือกไฟล์เพื่อแนบ'}</strong>
        <span>รองรับ PDF, Excel, JPG, PNG</span>
      </button>
    </div>
  )
}
