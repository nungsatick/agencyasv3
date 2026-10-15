'use client'

import React, { useMemo, useState } from 'react'

export type SortCol = { label: React.ReactNode; className?: string; sortable?: boolean }
export type SortVal = string | number | null | undefined
/** One row: what each cell shows, and the value each column sorts by (same order as the columns). */
export type SortRow = { key: string | number; cells: React.ReactNode[]; sort: SortVal[]; cellClass?: (string | undefined)[] }

const compare = (a: SortVal, b: SortVal) => {
  const empty = (v: SortVal) => v === null || v === undefined || v === ''
  if (empty(a) || empty(b)) return empty(a) === empty(b) ? 0 : empty(a) ? 1 : -1 // blanks last either way
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'th', { numeric: true })
}

/**
 * A summary table (overview, statistics, reports) whose headers sort the rows in the browser:
 * first click ascending, the next descending, with the same ▲ / ▼ / ↕ marks as the list pages.
 * Starts in the order the server gave unless `initial` says otherwise.
 */
export function SortTable({ columns, rows, initial }: { columns: SortCol[]; rows: SortRow[]; initial?: { col: number; desc?: boolean } }) {
  const [by, setBy] = useState<{ col: number; desc: boolean } | null>(initial ? { col: initial.col, desc: Boolean(initial.desc) } : null)
  const sorted = useMemo(() => {
    if (!by) return rows
    const out = [...rows].sort((x, y) => compare(x.sort[by.col], y.sort[by.col]))
    if (by.desc) {
      // keep blanks at the bottom when reversing
      const filled = out.filter((r) => !(r.sort[by.col] === null || r.sort[by.col] === undefined || r.sort[by.col] === ''))
      return [...filled.reverse(), ...out.slice(filled.length)]
    }
    return out
  }, [rows, by])

  return (
    <div className="agy__table-wrap">
      <table className="agy__table">
        <thead>
          <tr>
            {columns.map((c, i) => {
              if (c.sortable === false) return <th key={i} className={c.className}>{c.label}</th>
              const on = by?.col === i
              return (
                <th key={i} className={c.className} aria-sort={on ? (by!.desc ? 'descending' : 'ascending') : 'none'}>
                  <button
                    type="button"
                    className={`agy-dl__sort-h agy-sort-btn${on ? ' is-on' : ''}`}
                    title={on && !by!.desc ? 'กดเพื่อเรียงจากมากไปน้อย' : 'กดเพื่อเรียงจากน้อยไปมาก'}
                    onClick={() => setBy(on && !by!.desc ? { col: i, desc: true } : { col: i, desc: false })}
                  >
                    {c.label}
                    <span className="agy-dl__arrow" aria-hidden="true">
                      {on ? (by!.desc ? '▼' : '▲') : '↕'}
                    </span>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.key}>
              {r.cells.map((cell, i) => (
                <td key={i} className={r.cellClass?.[i] ?? columns[i].className}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
