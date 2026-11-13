import type { PayloadHandler } from 'payload'

import { searchCkan } from '../lib/ckanSearch'
import { ckanSyncRunning, syncCkan } from '../lib/ckanSync'
import { safeHref } from '../lib/urlRules'

// Searches per visitor per minute. Counted in memory only: the address is never stored.
const LIMIT = 30
const seen = new Map<string, { at: number; n: number }>()
function tooMany(req: Parameters<PayloadHandler>[0]): boolean {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local'
  const now = Date.now()
  const e = seen.get(ip)
  if (!e || now - e.at > 60_000) {
    seen.set(ip, { at: now, n: 1 })
    if (seen.size > 5000) for (const [k, v] of seen) if (now - v.at > 60_000) seen.delete(k)
    return false
  }
  return ++e.n > LIMIT
}

/** GET /api/ckan-search?province=<slug>&q=<question> — public: one province's datasets on the CKAN portals. */
export const ckanSearch: PayloadHandler = async (req) => {
  if (tooMany(req)) return Response.json({ error: 'ค้นหาบ่อยเกินไป กรุณารอสักครู่' }, { status: 429 })
  const sp = new URL(req.url!).searchParams
  const slug = sp.get('province') ?? ''
  const province = (await req.payload.find({ collection: 'provinces', where: { slug: { equals: slug } }, limit: 1, depth: 0, select: { nameTh: true } })).docs[0]
  if (!province) return Response.json({ error: 'ไม่พบจังหวัด' }, { status: 404 })
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 5, 1), 20)
  const r = await searchCkan(req.payload, { provinceId: province.id, provinceName: province.nameTh, q: sp.get('q') ?? '', limit })
  return Response.json(
    {
      total: r.total,
      results: r.hits.map((h) => ({
        title: h.title,
        description: h.notes.slice(0, 300),
        organization: h.orgTitle,
        url: safeHref(h.url) ?? null,
        formats: h.formats,
        hasTable: h.resources.some((x) => x.datastore),
        modifiedAt: h.modifiedAt,
        source: h.source,
      })),
    },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  )
}

/** POST /api/ckan-sync — central admins: refresh the copy now. Answers at once; the run goes on in the background. */
export const ckanSyncNow: PayloadHandler = async (req) => {
  if ((req.user as { role?: string } | null)?.role !== 'admin') return Response.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
  if (ckanSyncRunning()) return Response.json({ started: false, message: 'กำลังดึงข้อมูลอยู่แล้ว' })
  void syncCkan(req.payload).catch((err) => req.payload.logger.error({ err }, 'CKAN sync'))
  return Response.json({ started: true })
}
