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
type Answer = { total: number; offset: number; results: Result[]; faqs: Faq[]; catalogUrl: string }
type Message =
  | { id: number; who: 'me'; text: string }
  | { id: number; who: 'bot'; kind: 'intro' }
  | { id: number; who: 'bot'; kind: 'answer'; q: string; answer: Answer; more: boolean }
  | { id: number; who: 'bot'; kind: 'error'; text: string }

type NewMessage = Message extends infer M ? (M extends Message ? Omit<M, 'id'> : never) : never

export type AssistantTopic = { label: string; query: string }

const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' }) : null)

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </svg>
)

export function DataAssistant({ province, provinceName, topics }: { province: string; provinceName: string; topics: AssistantTopic[] }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([{ id: 0, who: 'bot', kind: 'intro' }])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
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
                      {answer.results.map((r) => (
                        <li key={r.id} className="assist__card">
                          {r.url ? (
                            <a href={r.url} target="_blank" rel="noopener noreferrer" className="assist__title">
                              {r.title}
                              <span className="sr-only"> (เปิดในแท็บใหม่)</span>
                            </a>
                          ) : (
                            <span className="assist__title">{r.title}</span>
                          )}
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
