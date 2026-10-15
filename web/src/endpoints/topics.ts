import { sql } from '@payloadcms/db-postgres'
import type { CollectionBeforeDeleteHook, Payload, PayloadHandler } from 'payload'
import { APIError } from 'payload'

import { logActivity } from '../lib/activity'

/** Live (not trashed) documents and dashboards that use a topic; `provinces` limits the count to those provinces. */
async function usage(payload: Payload, id: number, provinces?: number[]) {
  const scope = provinces ? sql`and province_id in (${sql.join(provinces.length ? provinces.map((p) => sql`${p}`) : [sql`-1`], sql`, `)})` : sql``
  const r = (
    await payload.db.drizzle.execute(sql`
      select (select count(*) from documents where topic_id = ${id} and deleted_at is null ${scope})::int as documents,
             (select count(*) from dashboards where topic_id = ${id} and deleted_at is null ${scope})::int as dashboards,
             (select count(*) from documents where topic_id = ${id} and deleted_at is not null ${scope})::int
               + (select count(*) from dashboards where topic_id = ${id} and deleted_at is not null ${scope})::int as trashed`)
  ).rows[0] as { documents: number; dashboards: number; trashed: number }
  return { documents: Number(r.documents), dashboards: Number(r.dashboards), trashed: Number(r.trashed) }
}

/** GET /api/topics/:id/usage */
export const topicUsage: PayloadHandler = async (req) => {
  if (!req.user) return Response.json({ error: 'ต้องเข้าสู่ระบบ' }, { status: 401 })
  // province staff see the counts of their own province only
  const u = req.user as { role?: string; provinces?: (number | { id: number })[] }
  const mine = u.role === 'admin' ? undefined : (u.provinces ?? []).map((p) => (typeof p === 'object' ? p.id : p))
  return Response.json(await usage(req.payload, Number(req.routeParams?.id), mine))
}

/** A topic still in use cannot be removed; move its items to another topic first (merge). */
export const refuseDeleteWhileUsed: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const u = await usage(req.payload, Number(id))
  if (u.documents || u.dashboards || u.trashed)
    throw new APIError(
      `ลบไม่ได้ ประเด็นนี้ยังมีเอกสาร ${u.documents} รายการ และแดชบอร์ด ${u.dashboards} รายการ${u.trashed ? ` (รวมในถังขยะ ${u.trashed})` : ''} ใช้ "ย้ายรายการไปประเด็นอื่นแล้วลบ" ในหน้าแก้ไขประเด็นแทน`,
      400,
      undefined,
      true,
    )
}

/**
 * POST /api/topics/:id/merge { into } — central admins only. Moves every document and dashboard
 * (including trashed ones and saved versions) from this topic to another, then removes this topic.
 */
export const mergeTopic: PayloadHandler = async (req) => {
  const user = req.user as { id: number; username?: string; role?: string } | null
  if (user?.role !== 'admin') return Response.json({ error: 'เฉพาะผู้ดูแลระบบส่วนกลาง' }, { status: 403 })
  const id = Number(req.routeParams?.id)
  const { into } = ((await req.json?.().catch(() => ({}))) ?? {}) as { into?: number }
  if (!into || into === id) return Response.json({ error: 'เลือกประเด็นปลายทางที่ไม่ใช่ประเด็นเดิม' }, { status: 400 })
  const [from, to] = await Promise.all([
    req.payload.findByID({ collection: 'topics', id, depth: 0 }).catch(() => null),
    req.payload.findByID({ collection: 'topics', id: into, depth: 0 }).catch(() => null),
  ])
  if (!from || !to) return Response.json({ error: 'ไม่พบประเด็น' }, { status: 404 })

  const before = await usage(req.payload, id)
  const db = req.payload.db.drizzle
  await db.execute(sql`update documents set topic_id = ${into} where topic_id = ${id}`)
  await db.execute(sql`update dashboards set topic_id = ${into} where topic_id = ${id}`)
  await db.execute(sql`update _documents_v set version_topic_id = ${into} where version_topic_id = ${id}`)
  await db.execute(sql`update _dashboards_v set version_topic_id = ${into} where version_topic_id = ${id}`)
  await req.payload.delete({ collection: 'topics', id, req })
  await logActivity(req.payload, {
    action: 'update',
    area: 'ประเด็น',
    subject: `รวม "${from.nameTh}" เข้ากับ "${to.nameTh}" (เอกสาร ${before.documents}, แดชบอร์ด ${before.dashboards})`,
    actor: user,
  })
  return Response.json({ ok: true, moved: before, into: to.nameTh })
}
