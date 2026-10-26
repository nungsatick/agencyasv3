import Link from 'next/link'
import type { AdminViewServerProps, PaginatedDocs } from 'payload'
import React from 'react'

import { thaiDay, thaiDayTime } from '@/lib/thaiDate'

import { Shell } from '../Shell'
import { FreshOnReturn } from './FreshOnReturn'
import { type CheckDef, ListFilters, type SelectDef } from './ListFilters'
import { LIMITS } from './limits'
import { Pager } from './Pager'

export const PER_PAGE = 25

/** `sort` names the field the column sorts by; its header then becomes a link that flips between ascending and descending. */
export type Column<T> = { label: string; className?: string; sort?: string; cell: (doc: T) => React.ReactNode }
export type SortDef = { label: string; sort: string[] }
export type Search = Record<string, string | undefined>

/** The sort the address asks for, or the first one. */
export const pickSort = (sp: Search, sorts: Record<string, SortDef>) => (sp.sort && sorts[sp.sort] ? sp.sort : Object.keys(sorts)[0])

// Fields a column header may sort by (?sort=field or ?sort=-field). Anything else falls back to the list's default,
// so the address cannot be used to sort on fields that are not shown.
const SORTABLE = new Set([
  'title', 'fiscalYear', 'updatedAt', 'createdAt', 'deletedAt', '_status', 'province.nameTh',
  'nameTh', 'sortOrder', 'color', 'theme', 'group', 'section',
  'originalName', 'mimeType', 'filesize', 'versionNo',
  'startsAt', 'priority',
  'username', 'role', 'status', 'lastLoginAt',
  'action', 'area', 'subject',
])
const sortField = (v?: string) => {
  const f = v?.replace(/^-/, '')
  return f && SORTABLE.has(f) ? f : null
}

/** What to pass as Payload's `sort`: the clicked column (with a stable tie-break), else the list's default order. */
export const sortFor = (sp: Search, sorts: Record<string, SortDef>): string[] =>
  sortField(sp.sort) ? [sp.sort!, '-id'] : sorts[pickSort(sp, sorts)].sort
export const pickPage = (sp: Search) => Math.max(1, Number(sp.page) || 1)
/** Rows per page: ?limit= when it is one of the offered sizes, else the list's own default. */
export const pickLimit = (sp: Search, fallback = PER_PAGE) => (LIMITS.includes(Number(sp.limit)) ? Number(sp.limit) : fallback)

const Icon = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

/** Main row action: open the record's edit screen. Icon only, like the trash button; the label is its tooltip. */
export const EditButton = ({ href, label = 'แก้ไข' }: { href: string; label?: string }) => (
  <Link href={href} className="agy__btn agy__btn--small agy__btn--primary agy__btn--icon" title={label} aria-label={label}>
    <Icon d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" />
  </Link>
)

/** Secondary row action: open something in a new tab (the public page, the file). Icon only. */
export const OpenButton = ({ href, label = 'ดูบนเว็บ', title }: { href: string | null; label?: string; title?: string }) =>
  href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="agy__btn agy__btn--small agy__btn--icon" title={title ?? label} aria-label={`${label} (แท็บใหม่)`}>
      <Icon d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    </a>
  ) : null

/** Row action: a list of documents (e.g. one province's). Icon only. */
export const DocsButton = ({ href, label = 'เอกสาร' }: { href: string; label?: string }) => (
  <Link href={href} className="agy__btn agy__btn--small agy__btn--icon" title={label} aria-label={label}>
    <Icon d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" />
  </Link>
)

/** Row action: the activity log, filtered to this record (a person's actions). Icon only. */
export const HistoryButton = ({ href, label = 'ประวัติการใช้งาน' }: { href: string; label?: string }) => (
  <Link href={href} className="agy__btn agy__btn--small agy__btn--icon" title={label} aria-label={label}>
    <Icon d="M12 7v5l3 2M3.05 11a9 9 0 1 1 .5 4M3 4v5h5" />
  </Link>
)

export const Pill = ({ tone, children }: { tone: 'ok' | 'wait' | 'review' | 'muted'; children: React.ReactNode }) => (
  <span className={`agy__pill agy__pill--${tone}`}>{children}</span>
)

/** "12 ต.ค. 69" and "12 ต.ค. 69 - 13.30 น." */
export const shortDay = (iso?: string | null) => thaiDay(iso)
export const dayTime = (iso?: string | null) => thaiDayTime(iso)
export const idOf = (v: unknown): number | null => (v == null ? null : typeof v === 'object' ? ((v as { id?: number }).id ?? null) : Number(v))

/**
 * One backoffice list page: heading with its buttons, the filter bar, a count with sort choices,
 * a striped table whose last column holds the row's buttons, and paging.
 */
export function ListPage<T extends { id: number | string }>(props: {
  view: AdminViewServerProps
  basePath: string
  title: string
  intro: React.ReactNode
  actions?: React.ReactNode
  search?: { label: string; placeholder: string }
  selects?: SelectDef[]
  checks?: CheckDef[]
  sp: Search
  result: PaginatedDocs<T>
  columns: Column<T>[]
  rowActions?: (doc: T) => React.ReactNode
  empty?: string
  footer?: React.ReactNode
}) {
  const { sp, result } = props
  const page = result.page ?? 1
  const link = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][])
    for (const [k, v] of Object.entries(changes)) {
      if (v === undefined || v === '') next.delete(k)
      else next.set(k, String(v))
    }
    const qs = next.toString()
    return `${props.basePath}${qs ? `?${qs}` : ''}`
  }
  const first = (page - 1) * result.limit + 1
  const last = first + result.docs.length - 1
  const n = (v: number) => v.toLocaleString('th-TH')
  // the column the list is sorted by, and which way
  const on = sortField(sp.sort)
  const desc = Boolean(on && sp.sort!.startsWith('-'))

  return (
    <Shell {...props.view} title={props.title}>
      <div className="agy agy-dl">
        <FreshOnReturn mark={`${Date.now()}-${Math.random()}`} />
        <div className="agy__head">
          <div>
            <h1>{props.title}</h1>
            <p className="agy__sub">{props.intro}</p>
          </div>
          {props.actions && <div className="agy__actions">{props.actions}</div>}
        </div>

        {(props.search || props.selects?.length || props.checks?.length) && <ListFilters search={props.search} selects={props.selects} checks={props.checks} />}

        <div className="agy-dl__bar">
          <span>{result.totalDocs ? `แสดง ${n(first)}–${n(last)} จาก ${n(result.totalDocs)} รายการ` : (props.empty ?? 'ไม่พบรายการที่ตรงกับตัวกรอง')}</span>
          {props.columns.some((c) => c.sort) && <span className="agy-dl__sorthint">กดหัวตารางเพื่อเรียงข้อมูล</span>}
          <Pager compact page={page} totalPages={result.totalPages} limit={result.limit} />
        </div>

        {result.docs.length > 0 && (
          <div className="agy__table-wrap">
            <table className="agy__table agy-dl__table">
              <thead>
                <tr>
                  {props.columns.map((c) => {
                    if (!c.sort) return (
                      <th key={c.label} className={c.className}>
                        {c.label}
                      </th>
                    )
                    const active = on === c.sort
                    // first click sorts ascending (น้อยไปมาก / ก–ฮ / เก่าไปใหม่), the next one descending
                    const next = active && !desc ? `-${c.sort}` : c.sort
                    return (
                      <th key={c.label} className={c.className} aria-sort={active ? (desc ? 'descending' : 'ascending') : 'none'}>
                        <Link
                          href={link({ sort: next, page: undefined })}
                          className={`agy-dl__sort-h${active ? ' is-on' : ''}`}
                          title={active && !desc ? 'กดเพื่อเรียงจากมากไปน้อย' : 'กดเพื่อเรียงจากน้อยไปมาก'}
                        >
                          {c.label}
                          <span className="agy-dl__arrow" aria-hidden="true">
                            {active ? (desc ? '▼' : '▲') : '↕'}
                          </span>
                        </Link>
                      </th>
                    )
                  })}
                  {props.rowActions && <th className="agy-dl__act-h">การทำงาน</th>}
                </tr>
              </thead>
              <tbody>
                {result.docs.map((d) => (
                  <tr key={d.id}>
                    {props.columns.map((c) => (
                      <td key={c.label} className={c.className}>
                        {c.cell(d)}
                      </td>
                    ))}
                    {props.rowActions && (
                      <td>
                        <div className="agy-dl__actions">{props.rowActions(d)}</div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* under the table: page numbers, "go to page" and the page size (shown once there is more than the smallest page) */}
        {result.totalDocs > LIMITS[0] && <Pager page={page} totalPages={result.totalPages} limit={result.limit} />}

        {props.footer && <p className="agy__sub agy-dl__foot">{props.footer}</p>}
      </div>
    </Shell>
  )
}
