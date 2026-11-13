import type { PayloadHandler } from 'payload'

import { searchCkan } from '../lib/ckanSearch'
import { catalogOf, ckanSyncRunning, syncCkan } from '../lib/ckanSync'
import { type DataSearchSettings, dataSearchSettings, matchFaq } from '../lib/dataSearch'
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

// the settings change rarely: read them at most once a minute
let settings: { at: number; value: DataSearchSettings } | null = null
async function currentSettings(req: Parameters<PayloadHandler>[0]): Promise<DataSearchSettings> {
  if (settings && Date.now() - settings.at < 60_000) return settings.value
  const g = await req.payload.findGlobal({ slug: 'site-settings', depth: 0 })
  settings = { at: Date.now(), value: dataSearchSettings(g.dataSearch) }
  return settings.value
}

/**
 * GET /api/ckan-search?province=<slug>&q=<question>&offset=<n> — public: one province's datasets on the
 * CKAN catalogs, plus any frequently asked question the words match. Answers 404 while the search is switched off.
 */
export const ckanSearch: PayloadHandler = async (req) => {
  if (tooMany(req)) return Response.json({ error: 'ค้นหาบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' }, { status: 429 })
  const s = await currentSettings(req)
  const admin = (req.user as { role?: string } | null)?.role === 'admin'
  if (!s.enabled && !admin) return Response.json({ error: 'ยังไม่เปิดใช้การค้นหาข้อมูล' }, { status: 404 })
  const sp = new URL(req.url!).searchParams
  const slug = sp.get('province') ?? ''
  const province = (await req.payload.find({ collection: 'provinces', where: { slug: { equals: slug } }, limit: 1, depth: 0, select: { nameTh: true, slug: true } })).docs[0]
  if (!province) return Response.json({ error: 'ไม่พบจังหวัด' }, { status: 404 })
  const q = (sp.get('q') ?? '').slice(0, 200)
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 5, 1), 20)
  const offset = Math.min(Math.max(Number(sp.get('offset')) || 0, 0), 500)
  const r = await searchCkan(req.payload, { provinceId: province.id, provinceName: province.nameTh, q, limit, offset, synonyms: s.synonyms })
  return Response.json(
    {
      total: r.total,
      offset,
      results: r.hits.map((h) => ({
        id: h.id,
        title: h.title,
        description: h.notes.slice(0, 240),
        organization: h.orgTitle,
        url: safeHref(h.url) ?? null,
        formats: h.formats.slice(0, 5),
        hasTable: h.resources.some((x) => x.datastore),
        modifiedAt: h.modifiedAt,
        source: h.source,
      })),
      faqs: offset ? [] : matchFaq(q, s.faq).map(({ question, answer, linkLabel, linkUrl }) => ({ question, answer, linkLabel, linkUrl })),
      catalogUrl: `${catalogOf(province.slug)}/dataset/?q=${encodeURIComponent(q)}`,
    },
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  )
}

/** POST /api/ckan-sync — central admins: refresh the copy now. Answers at once; the run goes on in the background. */
export const ckanSyncNow: PayloadHandler = async (req) => {
  if ((req.user as { role?: string } | null)?.role !== 'admin') return Response.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
  if (ckanSyncRunning()) return Response.json({ started: false, message: 'กำลังดึงข้อมูลอยู่แล้ว' })
  void syncCkan(req.payload).catch((err) => req.payload.logger.error({ err }, 'CKAN sync'))
  return Response.json({ started: true })
}
