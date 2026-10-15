import { sql } from '@payloadcms/db-postgres'
import config from '@payload-config'
import { getPayload } from 'payload'
import { cache } from 'react'

import type { File as FileDoc } from '@/payload-types'

/** Today's date in Thailand as YYYY-MM-DD. */
export const bangkokDay = (d = new Date()): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(d)

export const getSettings = cache(async () => {
  const payload = await getPayload({ config })
  return payload.findGlobal({ slug: 'site-settings', depth: 0 })
})

export type Mourning = { grayscale: boolean; grayLevel: number; ribbon: boolean; corner: 'left' | 'right'; keepEmbeds: boolean; message: string | null }

/** The mourning display to apply right now, or null when it is off or outside its dates. */
export async function activeMourning(): Promise<Mourning | null> {
  const m = (await getSettings()).mourning
  if (!m?.enabled) return null
  const today = bangkokDay()
  if (m.startsOn && bangkokDay(new Date(m.startsOn)) > today) return null
  if (m.endsOn && bangkokDay(new Date(m.endsOn)) < today) return null
  return {
    grayscale: m.grayscale !== false,
    // 100 = fully black and white; lower keeps some of the colour
    grayLevel: Math.min(100, Math.max(10, Number(m.grayLevel ?? 100) || 100)),
    ribbon: m.ribbon !== false,
    corner: m.ribbonCorner === 'right' ? 'right' : 'left',
    keepEmbeds: Boolean(m.keepEmbeds),
    message: m.message?.trim() || null,
  }
}

/** The GA4 measurement ID to use on the public pages, or null while Google Analytics is off. */
export async function analyticsId(): Promise<string | null> {
  const a = (await getSettings()).analytics
  const id = a?.measurementId?.trim()
  return a?.enabled && id && /^G-[A-Z0-9]{4,20}$/.test(id) ? id : null
}

export type Popup = {
  key: string
  title: string | null
  body: string | null
  imageUrl: string | null
  imageAlt: string | null
  buttonLabel: string | null
  buttonUrl: string | null
  frequency: 'always' | 'daily' | 'once'
}

/** The one announcement to pop up for this province and page, if any (highest priority wins). */
export async function activePopup(provinceId: number, page: string): Promise<Popup | null> {
  const payload = await getPayload({ config })
  const now = new Date().toISOString()
  const res = await payload.find({
    collection: 'announcements',
    where: {
      and: [
        { _status: { equals: 'published' } },
        { startsAt: { less_than_equal: now } },
        { or: [{ endsAt: { exists: false } }, { endsAt: { greater_than_equal: now } }] },
        { or: [{ allProvinces: { equals: true } }, { provinces: { in: [provinceId] } }] },
        ...(page === 'home' ? [] : [{ showOn: { equals: 'all' } }]),
      ],
    },
    sort: ['-priority', '-startsAt'],
    limit: 1,
    depth: 1,
  })
  const a = res.docs[0]
  if (!a) return null
  const image = typeof a.image === 'object' ? (a.image as FileDoc | null) : null
  return {
    // per province: closing it (or "don't show again") on one province's site leaves the other provinces alone
    key: `${provinceId}:${a.id}:${a.updatedAt}`,
    title: a.title?.trim() || null,
    body: a.body ?? null,
    imageUrl: image?.url ?? null,
    imageAlt: a.imageAlt?.trim() || null,
    buttonLabel: a.buttonLabel ?? null,
    buttonUrl: a.buttonUrl ?? null,
    frequency: a.frequency,
  }
}

export type HitKind = 'file_view' | 'file_download' | 'doc_link' | 'dashboard_view'

/** True for requests that should not be counted: robots, and staff who are signed in. */
export const uncounted = (userAgent: string | null, cookie: string | null): boolean =>
  !userAgent || BOT.test(userAgent) || /(^|;\s*)payload-token=/.test(cookie ?? '')

/** Add one to a running total (one row per kind and item; a single atomic upsert). */
export async function countHit(kind: HitKind, refId: number): Promise<void> {
  const payload = await getPayload({ config })
  await payload.db.drizzle.execute(sql`
    insert into hit_counts (kind, ref_id, hits, updated_at, created_at) values (${kind}, ${refId}, 1, now(), now())
    on conflict (kind, ref_id) do update set hits = hit_counts.hits + 1, updated_at = now()`)
}

/** Totals for a set of items, e.g. getHits('file_download', ids).get(id) ?? 0 */
export async function getHits(kind: HitKind, ids: number[]): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map()
  const payload = await getPayload({ config })
  const res = await payload.db.drizzle.execute(sql`
    select ref_id, hits::int as hits from hit_counts where kind = ${kind} and ref_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`)
  return new Map((res.rows as { ref_id: number; hits: number }[]).map((r) => [Number(r.ref_id), Number(r.hits)]))
}

const PAGES = new Set(['home', 'docs', 'utilization', 'guides'])
const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|curl|wget|python|node-fetch|monitor/i

/** Add one page view for today. Returns false when the request is not counted. */
export async function countVisit(slug: string, page: string, userAgent: string, signedIn: boolean): Promise<boolean> {
  if (!PAGES.has(page) || signedIn || !userAgent || BOT.test(userAgent)) return false
  const payload = await getPayload({ config })
  const province = (await payload.find({ collection: 'provinces', where: { slug: { equals: slug } }, limit: 1, depth: 0 })).docs[0]
  if (!province) return false
  // one row per province/day/page; the unique index makes this a single atomic upsert
  await payload.db.drizzle.execute(sql`
    insert into page_views (province_id, day, page, views, updated_at, created_at)
    values (${province.id}, ${bangkokDay()}, ${page}, 1, now(), now())
    on conflict (province_id, day, page) do update set views = page_views.views + 1, updated_at = now()`)
  return true
}

export type VisitStats = { today: number; month: number; fiscalYear: number; total: number; since: string | null }

export const getVisitStats = cache(async (provinceId: number): Promise<VisitStats> => {
  const payload = await getPayload({ config })
  const today = bangkokDay()
  const [y, m] = today.split('-').map(Number)
  const fyStart = `${m >= 10 ? y : y - 1}-10-01` // Thai fiscal year starts 1 October
  const res = await payload.db.drizzle.execute(sql`
    select coalesce(sum(views) filter (where day = ${today}), 0)::int as today,
           coalesce(sum(views) filter (where day >= ${today.slice(0, 7) + '-01'}), 0)::int as month,
           coalesce(sum(views) filter (where day >= ${fyStart}), 0)::int as fiscal_year,
           coalesce(sum(views), 0)::int as total,
           min(day) as since
    from page_views where province_id = ${provinceId}`)
  const row = (res.rows?.[0] ?? {}) as Record<string, unknown>
  return {
    today: Number(row.today ?? 0),
    month: Number(row.month ?? 0),
    fiscalYear: Number(row.fiscal_year ?? 0),
    total: Number(row.total ?? 0),
    since: (row.since as string) ?? null,
  }
})
