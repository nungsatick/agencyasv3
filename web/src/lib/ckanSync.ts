import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { forgetCkanIndex } from './ckanSearch'

/**
 * Copies the list of each province's datasets from the CKAN catalogs into ckan_datasets, for the
 * province data search. Read-only calls to the public CKAN API; nothing is sent to the catalogs.
 *  - province: each province's own catalog, <name>.gdcatalog.go.th (all its public datasets). The national
 *    gdcatalog.go.th is not read: its province datasets are copies of these.
 *  - statprovince: statprovince.gdcatalog.go.th, the datasets in the group "จังหวัด<name>" (one dataset covers many provinces)
 */
export const CKAN_SOURCES = ['province', 'statprovince'] as const
export type CkanSource = (typeof CKAN_SOURCES)[number]
const STATPROVINCE = 'https://statprovince.gdcatalog.go.th'

// A province catalog's host is <slug>.gdcatalog.go.th, except where our slug (kept from the old site) differs.
const CATALOG_HOST: Record<string, string> = {
  amnatchr: 'amnatcharoen', ayuttaya: 'phranakhonsiayutthaya', bungkan: 'buengkan', chchsao: 'chachoengsao', chmai: 'chiangmai',
  chrai: 'chiangrai', chtburi: 'chanthaburi', chyaphum: 'chaiyaphum', kcnburi: 'kanchanaburi', khkaen: 'khonkaen', kpphet: 'kamphaengphet',
  maehson: 'maehongson', naratwat: 'narathiwat', nblamphu: 'nongbualamphu', nknayok: 'nakhonnayok', nkpathom: 'nakhonpathom',
  nkphanom: 'nakhonphanom', nkrat: 'nakhonratchasima', nksawan: 'nakhonsawan', nksitham: 'nakhonsithammarat', nontburi: 'nonthaburi',
  pchburi: 'prachinburi', pchkkhan: 'prachuapkhirikhan', phatlung: 'phatthalung', phchabun: 'phetchabun', phetburi: 'phetchaburi',
  psnulok: 'phitsanulok', ptthani: 'pathumthani', ratburi: 'ratchaburi', sakonnk: 'sakonnakhon', sarakham: 'mahasarakham',
  skhothai: 'sukhothai', smprakan: 'samutprakan', smsakhon: 'samutsakhon', smskhram: 'samutsongkhram', suphan: 'suphanburi',
  surat: 'suratthani', ubon: 'ubonratchathani', udon: 'udonthani', uthai: 'uthaithani',
}
export const catalogOf = (slug: string) => `https://${CATALOG_HOST[slug] ?? slug}.gdcatalog.go.th`

type Pkg = {
  id: string
  name: string
  title: string
  notes?: string | null
  data_type?: string | null
  metadata_modified?: string | null
  organization?: { name: string; title: string } | null
  groups?: { name: string; display_name?: string; title?: string }[]
  tags?: { name: string }[]
  resources?: { id: string; name?: string | null; format?: string | null; url?: string | null; datastore_active?: boolean }[]
}
type Province = { id: number; code: string; slug: string; nameTh: string }
type Row = { key: string; provinceId: number; base: string; pkg: Pkg; orgTitle: string; groups: string[] }
type Fetched = { rows: Row[]; done: number[]; failed: string[] }

const PAGE = 1000
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function call<T>(base: string, action: string, params: Record<string, string | number>): Promise<T> {
  const url = `${base}/api/3/action/${action}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`
  let last: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'agencyas-catalog-sync', Accept: 'application/json' }, signal: AbortSignal.timeout(60_000) })
      if (!res.ok) throw new Error(`${new URL(base).host} ${action}: HTTP ${res.status}`)
      const body = (await res.json()) as { success: boolean; result: T; error?: unknown }
      if (!body.success) throw new Error(`${new URL(base).host} ${action}: ${JSON.stringify(body.error).slice(0, 200)}`)
      return body.result
    } catch (err) {
      last = err
      await pause(2000 * (attempt + 1))
    }
  }
  throw last
}

/** Every public dataset matching fq, a page of PAGE at a time, gently. */
async function searchAll(base: string, fq: string): Promise<Pkg[]> {
  const out: Pkg[] = []
  for (let start = 0; ; start += PAGE) {
    const r = await call<{ count: number; results: Pkg[] }>(base, 'package_search', { fq, rows: PAGE, start })
    out.push(...r.results)
    if (r.results.length < PAGE || out.length >= r.count) return out
    await pause(300)
  }
}

const groupTitle = (g: { display_name?: string; title?: string; name: string }) => g.display_name || g.title || g.name

/** Each province catalog in turn. A catalog that cannot be read goes in `failed`; its old rows are kept. */
async function fetchProvinceCatalogs(provinces: Province[]): Promise<Fetched> {
  const out: Fetched = { rows: [], done: [], failed: [] }
  for (const p of provinces) {
    const base = catalogOf(p.slug)
    try {
      for (const pkg of await searchAll(base, '')) {
        out.rows.push({ key: `province:${pkg.id}:${p.code}`, provinceId: p.id, base, pkg, orgTitle: pkg.organization?.title ?? '', groups: (pkg.groups ?? []).map(groupTitle) })
      }
      out.done.push(p.id)
    } catch {
      out.failed.push(p.nameTh)
    }
    await pause(300)
  }
  return out
}

async function fetchStatprovince(provinces: Province[]): Promise<Fetched> {
  const byName = new Map(provinces.map((p) => [`จังหวัด${p.nameTh}`, p]))
  const byGroup = new Map(provinces.map((p) => [`cwt_c_${p.code.toLowerCase()}`, p]))
  const rows: Row[] = []
  for (const pkg of await searchAll(STATPROVINCE, '')) {
    const groups = pkg.groups ?? []
    const isProvince = (g: (typeof groups)[number]) => byGroup.get(g.name) ?? byName.get(groupTitle(g).trim())
    // topic groups only: no province or Bangkok groups
    const topics = groups.filter((g) => !isProvince(g) && !/^(จังหวัด|กรุงเทพ)/.test(groupTitle(g).trim())).map(groupTitle)
    for (const g of groups) {
      const p = isProvince(g)
      if (p) rows.push({ key: `statprovince:${pkg.id}:${p.code}`, provinceId: p.id, base: STATPROVINCE, pkg, orgTitle: pkg.organization?.title ?? '', groups: topics })
    }
  }
  return { rows, done: provinces.map((p) => p.id), failed: [] }
}

const json = (v: unknown) => sql`${JSON.stringify(v)}::jsonb`

async function save(payload: Payload, source: CkanSource, rows: Row[], at: string): Promise<void> {
  const db = payload.db.drizzle
  for (let i = 0; i < rows.length; i += 300) {
    const values = rows.slice(i, i + 300).map(({ key, provinceId, base, pkg, orgTitle, groups }) => {
      const resources = (pkg.resources ?? []).map((r) => ({ id: r.id, name: r.name ?? '', format: (r.format ?? '').toUpperCase(), url: r.url ?? '', datastore: Boolean(r.datastore_active) }))
      const formats = [...new Set(resources.map((r) => r.format).filter(Boolean))]
      const modified = pkg.metadata_modified ? new Date(pkg.metadata_modified.endsWith('Z') ? pkg.metadata_modified : `${pkg.metadata_modified}Z`).toISOString() : null
      return sql`(${key}, ${source}, ${provinceId}, ${pkg.id}, ${pkg.name}, ${pkg.title || pkg.name}, ${pkg.notes ?? null}, ${orgTitle}, ${pkg.data_type ?? null},
        ${`${base}/dataset/${pkg.name}`}, ${json((pkg.tags ?? []).map((t) => t.name))}, ${json(groups)}, ${json(formats)}, ${json(resources)},
        ${modified}, ${at}, now(), now())`
    })
    await db.execute(sql`
      insert into ckan_datasets (key, source, province_id, ckan_id, ckan_name, title, notes, org_title, data_type, url, tags, groups, formats, resources, modified_at, synced_at, updated_at, created_at)
      values ${sql.join(values, sql`, `)}
      on conflict (key) do update set province_id = excluded.province_id, ckan_name = excluded.ckan_name, title = excluded.title, notes = excluded.notes,
        org_title = excluded.org_title, data_type = excluded.data_type, url = excluded.url, tags = excluded.tags, groups = excluded.groups,
        formats = excluded.formats, resources = excluded.resources, modified_at = excluded.modified_at, synced_at = excluded.synced_at, updated_at = now()`)
  }
}

export type SyncResult = { source: CkanSource; status: 'ok' | 'failed'; fetched: number; removed: number; note: string }

async function syncSource(payload: Payload, source: CkanSource, provinces: Province[]): Promise<SyncResult> {
  const startedAt = new Date().toISOString()
  const run = await payload.create({ collection: 'ckan-sync-runs', data: { source, startedAt, status: 'running' } })
  const finish = async (r: SyncResult) => {
    await payload.update({ collection: 'ckan-sync-runs', id: run.id, data: { finishedAt: new Date().toISOString(), status: r.status, fetched: r.fetched, removed: r.removed, note: r.note } })
    return r
  }
  try {
    const { rows, done, failed } = source === 'province' ? await fetchProvinceCatalogs(provinces) : await fetchStatprovince(provinces)
    const db = payload.db.drizzle
    const before = Number(((await db.execute(sql`select count(*)::int as n from ckan_datasets where source = ${source}`)).rows[0] as { n: number }).n)
    await save(payload, source, rows, startedAt)
    // a catalog that suddenly lists far fewer datasets is more likely broken than emptied: keep the old rows then
    if (before > 0 && rows.length < before * 0.5) {
      return await finish({ source, status: 'failed', fetched: rows.length, removed: 0, note: `ได้ ${rows.length} รายการ น้อยกว่าครึ่งของเดิม (${before}) จึงไม่ลบรายการเดิม` })
    }
    // rows no longer listed, only for the provinces read this time
    const ids = done.map((id) => sql`${id}`)
    const gone = ids.length
      ? (await db.execute(sql`delete from ckan_datasets where source = ${source} and synced_at < ${startedAt} and province_id in (${sql.join(ids, sql`, `)}) returning id`)).rows.length
      : 0
    const covered = new Set(rows.map((r) => r.provinceId)).size
    const note = [`ครอบคลุม ${covered} จังหวัด`, failed.length ? `อ่านไม่ได้ ${failed.length} จังหวัด (คงรายการเดิมไว้): ${failed.join(', ')}` : ''].filter(Boolean).join(' · ')
    return await finish({ source, status: failed.length > 10 ? 'failed' : 'ok', fetched: rows.length, removed: gone, note })
  } catch (err) {
    payload.logger.error({ err }, `CKAN sync ${source} failed`)
    return await finish({ source, status: 'failed', fetched: 0, removed: 0, note: String((err as Error).message ?? err).slice(0, 500) })
  } finally {
    forgetCkanIndex()
  }
}

/** Reads the province catalogs, then statprovince. A second call while one is running returns null. */
export async function syncCkan(payload: Payload): Promise<SyncResult[] | null> {
  const g = globalThis as { __agyCkanSyncing?: boolean }
  if (g.__agyCkanSyncing) return null
  g.__agyCkanSyncing = true
  try {
    const provinces = (await payload.find({ collection: 'provinces', limit: 200, depth: 0, pagination: false, sort: 'nameTh', select: { code: true, slug: true, nameTh: true } }))
      .docs as Province[]
    const out: SyncResult[] = []
    for (const source of CKAN_SOURCES) out.push(await syncSource(payload, source, provinces))
    // rows of a source no longer read (gdcatalog.go.th, replaced by the province catalogs)
    if (out[0].status === 'ok') {
      await payload.db.drizzle.execute(sql`delete from ckan_datasets where source not in (${sql.join(CKAN_SOURCES.map((x) => sql`${x}`), sql`, `)})`)
      forgetCkanIndex()
    }
    // search words are kept for a year
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await payload.db.drizzle.execute(sql`delete from ckan_search_stats where day < ${yearAgo}`)
    return out
  } finally {
    g.__agyCkanSyncing = false
  }
}

export const ckanSyncRunning = () => Boolean((globalThis as { __agyCkanSyncing?: boolean }).__agyCkanSyncing)

/**
 * Once a night (01:00–05:00 Bangkok time), when the last successful run is more than 20 hours old.
 * Set CKAN_SYNC=off to switch it off (for example on a machine that cannot reach the catalogs).
 */
export function scheduleCkanSync(payload: Payload): void {
  const g = globalThis as { __agyCkanSchedule?: boolean }
  if (g.__agyCkanSchedule || process.env.CKAN_SYNC === 'off') return
  g.__agyCkanSchedule = true
  const tick = async () => {
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', hour12: false }).format(new Date()))
    if (hour < 1 || hour >= 5) return
    const last = await payload.find({ collection: 'ckan-sync-runs', where: { status: { equals: 'ok' } }, sort: '-startedAt', limit: 1, depth: 0 })
    const at = last.docs[0]?.startedAt
    if (at && Date.now() - new Date(at).getTime() < 20 * 60 * 60 * 1000) return
    await syncCkan(payload)
  }
  setInterval(() => void tick().catch((err) => payload.logger.error({ err }, 'CKAN sync schedule')), 30 * 60 * 1000).unref()
}
