import type { CollectionConfig, PayloadHandler, PayloadRequest, Where } from 'payload'

import { provinceIds } from '../access'
import { logActivity } from '../lib/activity'
import { checkAll, phoneDigits, tidy } from '../lib/fieldRules'

type AnyUser = { id: number; username?: string; role: string; provinces?: (number | { id: number })[] }
const json = (data: unknown, status = 200) => Response.json(data, { status })
const DAY = 86_400_000
/** Requests are kept 30 days, then removed (they hold personal data of people who may never get an account). */
const KEEP_DAYS = 30
/** At most this many waiting requests per province, so a flood cannot bury the real ones. */
const MAX_PENDING_PER_PROVINCE = 20

// Saved requests per sender (IP address), held in memory only, nothing about the sender is stored.
// 20 an hour: enough for a whole office behind one address, too few for a flood. Only requests that were
// saved count, so someone correcting a mistake does not use the allowance up. Off on a development machine,
// where every test comes from the same address.
const PER_HOUR = 20
const LIMIT_ON = process.env.NODE_ENV === 'production'
const recent = new Map<string, number[]>()
const lastHour = (key: string) => (recent.get(key) ?? []).filter((t) => Date.now() - t < 3_600_000)
function tooMany(key: string): boolean {
  return LIMIT_ON && lastHour(key).length >= PER_HOUR
}
function countSaved(key: string) {
  if (!LIMIT_ON) return
  if (recent.size > 5000) recent.clear()
  recent.set(key, [...lastHour(key), Date.now()])
}
// The visitor's address as nginx saw it (deploy/nginx.conf sets X-Real-IP to $remote_addr). The first entry of
// X-Forwarded-For is whatever the visitor sent, so it is not trusted; its last entry is the one nginx added.
const senderOf = (req: PayloadRequest) =>
  req.headers.get('x-real-ip')?.trim() || (req.headers.get('x-forwarded-for') ?? '').split(',').pop()?.trim() || 'local'

/** Remove requests older than KEEP_DAYS. Cheap; runs whenever a request comes in or the list is opened. */
export async function forgetOldRequests(req: PayloadRequest) {
  await req.payload.delete({
    collection: 'account-requests',
    where: { createdAt: { less_than: new Date(Date.now() - KEEP_DAYS * DAY).toISOString() } },
    overrideAccess: true,
  })
}

const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

/** POST /api/account-requests/submit — the public "ขอใช้บัญชีเจ้าหน้าที่" form. No sign-in. */
const submit: PayloadHandler = async (req) => {
  const body = ((await req.json?.().catch(() => null)) ?? {}) as Record<string, unknown>
  // a hidden field people never see, and a form filled in under 3 seconds: both are robots
  if (text(body.website, 200) || Date.now() - Number(body.startedAt ?? 0) < 3000) return json({ ok: true })
  if (tooMany(senderOf(req))) return json({ error: 'ส่งคำขอบ่อยเกินไป กรุณาลองใหม่ในอีก 1 ชั่วโมง' }, 429)

  // the same rules as the form (lib/fieldRules.ts); the first box that fails is named, so the form can mark it
  const bad = checkAll(body, {
    name: { rule: 'nameTh' },
    nameEn: { rule: 'nameEn' },
    position: { rule: 'text' },
    unit: { rule: 'text' },
    phone: { rule: 'phone' },
    email: { rule: 'email' },
    note: { rule: 'note', required: false },
  })
  const firstBad = Object.keys(bad)[0]
  if (firstBad) return json({ error: bad[firstBad], field: firstBad }, 400)
  const name = tidy(body.name)
  const nameEn = tidy(body.nameEn)
  const position = tidy(body.position)
  const unit = tidy(body.unit)
  const phone = phoneDigits(body.phone)
  const email = String(body.email).trim().toLowerCase()
  const province = Number(body.province)
  if (!body.consent) return json({ error: 'กรุณาติ๊กยินยอมก่อนส่งคำขอ', field: 'consent' }, 400)
  const found = await req.payload.find({ collection: 'provinces', where: { id: { equals: province } }, limit: 1, depth: 0, overrideAccess: true })
  if (!found.docs[0]) return json({ error: 'กรุณาเลือกจังหวัด', field: 'province' }, 400)

  await forgetOldRequests(req)
  const waiting = await req.payload.count({ collection: 'account-requests', where: { province: { equals: province }, status: { equals: 'pending' } }, overrideAccess: true })
  if (waiting.totalDocs >= MAX_PENDING_PER_PROVINCE) return json({ error: 'จังหวัดนี้มีคำขอรอพิจารณาจำนวนมาก กรุณาติดต่อผู้ดูแลจังหวัดโดยตรง' }, 429)

  await req.payload.create({
    collection: 'account-requests',
    data: { name, nameEn, province, position, unit, phone, email, note: tidy(body.note) || undefined, status: 'pending' },
    overrideAccess: true,
  })
  countSaved(senderOf(req))
  await logActivity(req.payload, { action: 'account_request', area: 'คำขอบัญชี', subject: name, province, actor: null })
  return json({ ok: true })
}

/** POST /api/account-requests/:id/reject — turn a request down (approving goes through the add-user form). */
const reject: PayloadHandler = async (req) => {
  const actor = req.user as AnyUser | null
  if (!actor || !['admin', 'province_manager'].includes(actor.role)) return json({ error: 'ไม่มีสิทธิ์' }, 403)
  const id = Number(req.routeParams?.id)
  const r = await req.payload.findByID({ collection: 'account-requests', id, depth: 0, user: actor, overrideAccess: false }).catch(() => null)
  if (!r) return json({ error: 'ไม่พบคำขอ' }, 404)
  if (r.status !== 'pending') return json({ error: 'คำขอนี้พิจารณาไปแล้ว' }, 409)
  await req.payload.update({ collection: 'account-requests', id, data: { status: 'rejected', decidedBy: actor.id, decidedAt: new Date().toISOString() }, overrideAccess: true })
  await logActivity(req.payload, { action: 'account_request_reject', area: 'คำขอบัญชี', subject: r.name, province: r.province as number, actor })
  return json({ ok: true })
}

/** POST /api/account-requests/:id/remove — delete a turned-down request now instead of waiting 30 days. */
const remove: PayloadHandler = async (req) => {
  const actor = req.user as AnyUser | null
  if (!actor || !['admin', 'province_manager'].includes(actor.role)) return json({ error: 'ไม่มีสิทธิ์' }, 403)
  const id = Number(req.routeParams?.id)
  // read with the person's own rights: a province manager only reaches requests of their province
  const r = await req.payload.findByID({ collection: 'account-requests', id, depth: 0, user: actor, overrideAccess: false }).catch(() => null)
  if (!r) return json({ error: 'ไม่พบคำขอ' }, 404)
  if (r.status !== 'rejected') return json({ error: 'ลบได้เฉพาะคำขอที่ไม่อนุมัติ' }, 409)
  await req.payload.delete({ collection: 'account-requests', id, overrideAccess: true })
  await logActivity(req.payload, { action: 'delete', area: 'คำขอบัญชี', subject: r.name, province: r.province as number, actor })
  return json({ ok: true })
}

/** Called by the add-user endpoint after the account was made from a request. */
export async function markApproved(req: PayloadRequest, requestId: number, userId: number) {
  const actor = req.user as AnyUser
  const r = await req.payload.findByID({ collection: 'account-requests', id: requestId, depth: 0, user: actor, overrideAccess: false }).catch(() => null)
  if (!r || r.status !== 'pending') return
  await req.payload.update({ collection: 'account-requests', id: requestId, data: { status: 'approved', decidedBy: actor.id, decidedAt: new Date().toISOString(), user: userId }, overrideAccess: true })
  await logActivity(req.payload, { action: 'account_request_approve', area: 'คำขอบัญชี', subject: r.name, province: r.province as number, actor })
}

/** Central admins see every request; province managers see their own province's. Nobody else. */
const readOwn = ({ req: { user } }: { req: { user: unknown } }): boolean | Where => {
  const u = user as AnyUser | null
  if (u?.role === 'admin') return true
  if (u?.role === 'province_manager') return { province: { in: provinceIds(u) } }
  return false
}

// Someone asking for a backoffice account through the public form. Nothing is created until a
// province manager or central admin approves it in "เพิ่มและนำเข้าผู้ใช้", which then issues the usual one-time link.
export const AccountRequests: CollectionConfig = {
  slug: 'account-requests',
  labels: { singular: 'คำขอบัญชี', plural: 'คำขอบัญชี' },
  admin: {
    group: 'ผู้ใช้งาน',
    useAsTitle: 'name',
    hidden: ({ user }) => !['admin', 'province_manager'].includes((user as unknown as { role?: string } | null)?.role ?? ''),
  },
  defaultSort: '-createdAt',
  access: { read: readOwn, create: () => false, update: () => false, delete: ({ req: { user } }) => (user as AnyUser | null)?.role === 'admin' },
  endpoints: [
    { path: '/submit', method: 'post', handler: submit },
    { path: '/:id/reject', method: 'post', handler: reject },
    { path: '/:id/remove', method: 'post', handler: remove },
  ],
  fields: [
    { name: 'name', type: 'text', required: true, label: 'ชื่อ นามสกุล' },
    { name: 'nameEn', type: 'text', label: 'ชื่อ-นามสกุล (ภาษาอังกฤษ)' },
    { name: 'province', type: 'relationship', relationTo: 'provinces', required: true, index: true, label: 'จังหวัด' },
    { name: 'position', type: 'text', label: 'ตำแหน่ง' },
    { name: 'unit', type: 'text', label: 'หน่วยงาน' },
    { name: 'phone', type: 'text', required: true, label: 'โทรศัพท์' },
    { name: 'email', type: 'text', label: 'อีเมล' },
    { name: 'note', type: 'textarea', label: 'เหตุผลที่ขอใช้' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      label: 'สถานะ',
      options: [
        { label: 'รอพิจารณา', value: 'pending' },
        { label: 'อนุมัติแล้ว', value: 'approved' },
        { label: 'ไม่อนุมัติ', value: 'rejected' },
      ],
    },
    { name: 'decidedBy', type: 'relationship', relationTo: 'users', label: 'ผู้พิจารณา' },
    { name: 'decidedAt', type: 'date', label: 'พิจารณาเมื่อ' },
    { name: 'user', type: 'relationship', relationTo: 'users', label: 'บัญชีที่สร้าง' },
  ],
}
