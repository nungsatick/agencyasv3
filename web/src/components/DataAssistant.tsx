'use client'

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'

/**
 * "ค้นหาข้อมูล": a small chat-like box on every page of a province site. Visitors type what they look for,
 * or press a topic, and get the province's datasets from the CKAN catalogs (/api/ckan-search).
 * No AI: the answers are search results and the central admin's frequently asked questions.
 * It lives in the province layout, so the conversation stays while pages change.
 */

type Result = {
  id: number
  title: string
  description: string
  organization: string
  url: string | null
  formats: string[]
  hasTable: boolean
  modifiedAt: string | null
}
type Faq = { question: string; answer: string; linkLabel: string | null; linkUrl: string | null }
type Preview = { resource: string; fields: string[]; rows: (string | number | null)[][]; total: number; province: boolean; note: string | null }
type PreviewState = { state: 'loading' } | { state: 'ok'; data: Preview } | { state: 'error'; text: string }
type Answer = { total: number; offset: number; results: Result[]; faqs: Faq[]; catalogUrl: string }
type Message =
  | { id: number; who: 'me'; text: string }
  | { id: number; who: 'bot'; kind: 'intro' }
  | { id: number; who: 'bot'; kind: 'answer'; q: string; answer: Answer; more: boolean }
  | { id: number; who: 'bot'; kind: 'error'; text: string }

type NewMessage = Message extends infer M ? (M extends Message ? Omit<M, 'id'> : never) : never

export type AssistantTopic = { label: string; query: string }

// columns holding years or periods are shown as written (2568, not 2,568)
const YEARISH = /ปี|year|period|time|date|วันที่|เดือน|code|รหัส/i

const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' }) : null)

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </svg>
)

const EyeIcon = ({ closed }: { closed: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {closed && <path d="M3 3l18 18" />}
  </svg>
)

export function DataAssistant({ province, provinceName, topics }: { province: string; provinceName: string; topics: AssistantTopic[] }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([{ id: 0, who: 'bot', kind: 'intro' }])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  // the tables opened under results, by dataset id
  const [previews, setPreviews] = useState<Record<number, PreviewState>>({})
  const nextId = useRef(1)
  const input = useRef<HTMLInputElement>(null)
  const launcher = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const panelId = useId()

  const close = useCallback(() => {
    setOpen(false)
    launcher.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    input.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  // keep the newest message in view
  useEffect(() => {
    const el = list.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [messages, open])

  const push = (m: NewMessage) => setMessages((all) => [...all, { ...m, id: nextId.current++ } as Message])

  const ask = async (q: string, offset = 0) => {
    const question = q.trim()
    if (busy) return
    if (!offset) push({ who: 'me', text: question || 'ชุดข้อมูลล่าสุด' })
    setBusy(true)
    try {
      const res = await fetch(`/api/ckan-search?${new URLSearchParams({ province, q: question, offset: String(offset), limit: '5' })}`)
      const body = (await res.json()) as Answer & { error?: string }
      if (!res.ok) throw new Error(body.error ?? 'ค้นหาไม่สำเร็จ')
      // "more" adds to the answer it continues; a new question starts a new answer
      setMessages((all) => {
        const rest = offset ? all.map((m) => (m.who === 'bot' && m.kind === 'answer' && m.q === question && m.more ? { ...m, more: false } : m)) : all
        return [...rest, { id: nextId.current++, who: 'bot', kind: 'answer', q: question, answer: body, more: body.offset + body.results.length < body.total }]
      })
    } catch (err) {
      push({ who: 'bot', kind: 'error', text: (err as Error).message === 'Failed to fetch' ? 'เชื่อมต่อไม่ได้ กรุณาลองใหม่' : (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  /** Shows or hides the first rows of a dataset's table under its card. */
  const togglePreview = async (id: number) => {
    if (previews[id]) {
      setPreviews(({ [id]: _gone, ...rest }) => rest)
      return
    }
    setPreviews((all) => ({ ...all, [id]: { state: 'loading' } }))
    try {
      const res = await fetch(`/api/ckan-preview?id=${id}`)
      const body = (await res.json()) as Preview & { error?: string }
      if (!res.ok) throw new Error(body.error ?? 'ดึงตัวอย่างไม่ได้')
      setPreviews((all) => ({ ...all, [id]: { state: 'ok', data: body } }))
    } catch (err) {
      const text = (err as Error).message === 'Failed to fetch' ? 'เชื่อมต่อไม่ได้ กรุณาลองใหม่' : (err as Error).message
      setPreviews((all) => ({ ...all, [id]: { state: 'error', text } }))
    }
  }

  const previewOf = (id: number, title: string) => {
    const p = previews[id]
    if (!p) return null
    if (p.state === 'loading') return <p className="assist__preview-msg">กำลังดึงตัวอย่าง…</p>
    if (p.state === 'error') return <p className="assist__preview-msg assist__preview-msg--error">{p.text}</p>
    const { data } = p
    return (
      <div className="assist__preview">
        <div className="assist__table" tabIndex={0} role="region" aria-label={`ตัวอย่างตาราง ${title}`}>
          <table>
            <thead>
              <tr>
                {data.fields.map((f) => (
                  <th key={f} scope="col">
                    {f}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((v, j) => (
                    <td key={j} className={typeof v === 'number' ? 'is-num' : undefined}>
                      {v == null ? '' : typeof v === 'number' && !YEARISH.test(data.fields[j]) ? v.toLocaleString('th-TH') : String(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="assist__preview-msg">
          {data.note ?? `แสดง ${data.rows.length.toLocaleString('th-TH')} แถว${data.total > data.rows.length ? ` จากทั้งหมด ${data.total.toLocaleString('th-TH')} แถว` : ''}${data.province ? ` ของจังหวัด${provinceName}` : ''}`}
          {data.resource && ` · ไฟล์ ${data.resource}`}
        </p>
      </div>
    )
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    void ask(text)
    setText('')
  }

  const restart = () => {
    setMessages([{ id: nextId.current++, who: 'bot', kind: 'intro' }])
    input.current?.focus()
  }

  const topicChips = (
    <div className="assist__chips">
      {topics.map((t) => (
        <button key={t.label} type="button" className="assist__chip" disabled={busy} onClick={() => void ask(t.query)}>
          {t.label}
        </button>
      ))}
    </div>
  )

  return (
    <>
      <button
        ref={launcher}
        type="button"
        className={open ? 'assist-launch is-open' : 'assist-launch'}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <SearchIcon />
        <span className="assist-launch__text">ค้นหาข้อมูล</span>
      </button>

      <section id={panelId} className="assist" role="dialog" aria-modal="false" aria-labelledby={titleId} hidden={!open}>
        <header className="assist__head">
          <div>
            <h2 id={titleId}>ค้นหาข้อมูลจังหวัด{provinceName}</h2>
            <p>จากระบบบัญชีข้อมูลจังหวัดและ statprovince</p>
          </div>
          <button type="button" className="assist__icon" onClick={restart} title="เริ่มใหม่" aria-label="เริ่มค้นหาใหม่">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          <button type="button" className="assist__icon" onClick={close} title="ปิด" aria-label="ปิดหน้าต่างค้นหาข้อมูล">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="assist__list" ref={list} aria-live="polite">
          {messages.map((m) => {
            if (m.who === 'me')
              return (
                <p key={m.id} className="assist__me">
                  {m.text}
                </p>
              )
            if (m.kind === 'intro')
              return (
                <div key={m.id} className="assist__bot">
                  <p>พิมพ์ข้อมูลที่ต้องการ เช่น &quot;ประชากร&quot; &quot;ผลผลิตข้าว ปี 2566&quot; หรือ &quot;ปริมาณน้ำฝน excel&quot; หรือเลือกหมวดด้านล่าง</p>
                  {topicChips}
                </div>
              )
            if (m.kind === 'error')
              return (
                <p key={m.id} className="assist__bot assist__bot--error" role="alert">
                  {m.text}
                </p>
              )
            const { answer } = m
            return (
              <div key={m.id} className="assist__bot">
                {answer.faqs.map((f) => (
                  <div key={f.question} className="assist__faq">
                    <strong>{f.question}</strong>
                    <p>{f.answer}</p>
                    {f.linkUrl && (
                      <a href={f.linkUrl} target="_blank" rel="noopener noreferrer">
                        {f.linkLabel || 'อ่านเพิ่มเติม'}
                      </a>
                    )}
                  </div>
                ))}
                {answer.results.length > 0 ? (
                  <>
                    {!answer.offset && <p>พบ {answer.total.toLocaleString('th-TH')} ชุดข้อมูลที่เกี่ยวข้อง</p>}
                    <ol className="assist__results" start={answer.offset + 1}>
                      {answer.results.map((r, i) => (
                        <li key={r.id} className="assist__card">
                          <span className="assist__head-row">
                            {/* the place in all results (1 to total), so a long list stays easy to follow */}
                            <span className="assist__no" aria-hidden="true">
                              {(answer.offset + i + 1).toLocaleString('th-TH')}
                            </span>
                            {r.url ? (
                              <a href={r.url} target="_blank" rel="noopener noreferrer" className="assist__title">
                                {r.title}
                                <span className="sr-only"> (เปิดในแท็บใหม่)</span>
                              </a>
                            ) : (
                              <span className="assist__title">{r.title}</span>
                            )}
                          </span>
                          <span className="assist__meta">
                            {r.organization}
                            {day(r.modifiedAt) && ` · ปรับปรุง ${day(r.modifiedAt)}`}
                          </span>
                          {(r.formats.length > 0 || r.hasTable) && (
                            <span className="assist__tags">
                              {r.formats.map((f) => (
                                <span key={f} className="assist__tag">
                                  {f}
                                </span>
                              ))}
                              {r.hasTable && <span className="assist__tag assist__tag--table">มีตารางข้อมูล</span>}
                            </span>
                          )}
                          {r.hasTable && (
                            <button
                              type="button"
                              className="assist__peek"
                              aria-expanded={Boolean(previews[r.id])}
                              aria-label={`${previews[r.id] ? 'ซ่อน' : 'ดู'}ตัวอย่างตัวเลขของ ${r.title}`}
                              onClick={() => void togglePreview(r.id)}
                            >
                              <EyeIcon closed={Boolean(previews[r.id])} />
                              {previews[r.id] ? 'ซ่อนตัวอย่าง' : 'ตัวอย่าง'}
                            </button>
                          )}
                          {previewOf(r.id, r.title)}
                        </li>
                      ))}
                    </ol>
                    {m.more && (
                      <button type="button" className="assist__more" disabled={busy} onClick={() => void ask(m.q, answer.offset + answer.results.length)}>
                        ดูเพิ่มอีก
                      </button>
                    )}
                  </>
                ) : (
                  !answer.faqs.length && (
                    <>
                      <p>ไม่พบชุดข้อมูลที่ตรงกับคำค้นนี้ ลองใช้คำที่สั้นลงหรือคำอื่นที่มีความหมายใกล้เคียง หรือเลือกหมวด</p>
                      {topicChips}
                    </>
                  )
                )}
                {!answer.offset && (
                  <a className="assist__catalog" href={answer.catalogUrl} target="_blank" rel="noopener noreferrer">
                    ค้นต่อในระบบบัญชีข้อมูลจังหวัด{provinceName}
                  </a>
                )}
              </div>
            )
          })}
          {busy && (
            <p className="assist__bot assist__typing" aria-label="กำลังค้นหา">
              <span />
              <span />
              <span />
            </p>
          )}
        </div>

        <form className="assist__form" onSubmit={submit} role="search">
          <label className="sr-only" htmlFor={`${panelId}-q`}>
            ข้อมูลที่ต้องการค้นหา
          </label>
          <input
            ref={input}
            id={`${panelId}-q`}
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="พิมพ์ข้อมูลที่ต้องการ…"
            maxLength={200}
            autoComplete="off"
            enterKeyHint="search"
          />
          <button type="submit" disabled={busy || !text.trim()} aria-label="ค้นหา">
            <SearchIcon />
          </button>
        </form>
      </section>
    </>
  )
}
