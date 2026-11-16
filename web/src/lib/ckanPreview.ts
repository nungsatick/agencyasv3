import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

/**
 * The first rows of a dataset's table (CKAN datastore), for "ดูตัวอย่างตัวเลข" in the province data search.
 * Only datasets in ckan_datasets, and only their own catalog's API (a *.gdcatalog.go.th host over https),
 * so the server never fetches an address a visitor chooses. statprovince tables hold every province:
 * they are narrowed to this province by the CWT column (the province's Thai name).
 */

export type Preview = {
  resource: string
  fields: string[]
  rows: (string | number | null)[][]
  total: number
  /** true when the rows are this province's only */
  province: boolean
  note: string | null
}

const ROWS = 20
const TTL = 60 * 60 * 1000
const HIDDEN = new Set(['_id', 'UNIT_MUL', 'FREQ'])
const cache = (): Map<number, { at: number; value: Preview | null }> => {
  const g = globalThis as { __agyCkanPreview?: Map<number, { at: number; value: Preview | null }> }
  return (g.__agyCkanPreview ??= new Map())
}

type Search = { fields: { id: string }[]; records: Record<string, unknown>[]; total: number }

async function datastore(base: string, params: Record<string, string>): Promise<Search> {
  const res = await fetch(`${base}/api/3/action/datastore_search?${new URLSearchParams(params)}`, {
    headers: { 'User-Agent': 'agencyas-catalog-preview', Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = (await res.json()) as { success: boolean; result: Search }
  if (!body.success) throw new Error('datastore_search failed')
  return body.result
}

export async function previewOf(payload: Payload, id: number): Promise<Preview | null> {
  const hit = cache().get(id)
  if (hit && Date.now() - hit.at < TTL) return hit.value
  const row = (
    await payload.db.drizzle.execute(sql`
      select d.url, d.source, d.resources, p.name_th from ckan_datasets d join provinces p on p.id = d.province_id where d.id = ${id}`)
  ).rows[0] as { url: string; source: string; resources: { id: string; name: string; datastore: boolean }[]; name_th: string } | undefined
  if (!row) return null
  const resource = (row.resources ?? []).find((r) => r.datastore)
  const origin = new URL(row.url)
  if (!resource || origin.protocol !== 'https:' || !origin.hostname.endsWith('.gdcatalog.go.th')) return null
  const base = origin.origin

  const head = await datastore(base, { resource_id: resource.id, limit: '0' })
  const names = head.fields.map((f) => f.id)
  const params: Record<string, string> = { resource_id: resource.id, limit: String(ROWS) }
  // newest first where the table has a period column
  const period = names.find((n) => /^(TIME_PERIOD|YEAR|ปี|ปีงบประมาณ)$/i.test(n))
  if (period) params.sort = `${period} desc`
  let province = row.source === 'province'
  let note: string | null = null
  let data: Search | null = null
  if (row.source === 'statprovince' && names.includes('CWT')) {
    data = await datastore(base, { ...params, filters: JSON.stringify({ CWT: row.name_th }) })
    if (data.total > 0) province = true
    else data = null
  }
  if (!data) {
    data = await datastore(base, params)
    if (row.source === 'statprovince') note = `ตารางนี้ไม่มีข้อมูลแยกของจังหวัด${row.name_th} (แสดงตัวอย่างระดับภาคหรือทั้งประเทศ)`
  }
  const fields = names.filter((n) => !HIDDEN.has(n))
  const value: Preview = {
    resource: resource.name,
    fields,
    rows: data.records.map((r) => fields.map((f) => (r[f] == null ? null : typeof r[f] === 'number' ? (r[f] as number) : String(r[f]).slice(0, 120)))),
    total: data.total,
    province,
    note,
  }
  cache().set(id, { at: Date.now(), value })
  return value
}
