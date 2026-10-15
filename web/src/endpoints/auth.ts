import type { PayloadHandler, PayloadRequest } from 'payload'
import { generatePayloadCookie } from 'payload'
import QRCode from 'qrcode'

import { provinceIds } from '../access'
import {
  checkPassword,
  newLinkToken,
  newRecoveryCodes,
  newTotpSecret,
  normalizeRecoveryCode,
  otpauthUrl,
  randomPassword,
  seal,
  sha256,
  unseal,
  verifyTotp,
} from '../lib/auth'
import { logActivity } from '../lib/activity'
import { INACTIVE_DAYS, INACTIVE_REASON } from '../lib/maintenance'
import { markApproved } from '../collections/AccountRequests'
import { checkAll, phoneDigits } from '../lib/fieldRules'

/*
 * Sign-in is two steps and never involves email:
 *   1. POST /api/users/sign-in        username + password → a short-lived "pending" ticket
 *   2. POST /api/users/sign-in/code   ticket + 6-digit code (or a recovery code) → session cookie
 * A user without 2FA yet is walked through setup in step 2 (QR, confirm a code, recovery codes).
 * Payload's own /api/users/login is blocked by the collection's beforeLogin hook.
 */

type Pending = { token: string; userId: number; setupSecret?: string }
type AnyUser = Record<string, any>

const json = (body: unknown, status = 200, headers?: HeadersInit) => Response.json(body, { status, headers })
const body = async (req: PayloadRequest): Promise<Record<string, any>> => (req.json ? await req.json().catch(() => ({})) : {})
const fullUser = (req: PayloadRequest, id: number | string): Promise<AnyUser> =>
  req.payload.findByID({ collection: 'users', id, depth: 0, showHiddenFields: true, overrideAccess: true })

const GENERIC = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
const MAX_CODE_ATTEMPTS = 5
const LOCK_MS = 15 * 60 * 1000

/** Verify the password, then hand back a ticket for the second step. */
async function passwordStep(req: PayloadRequest, username: string, password: string) {
  let result
  try {
    result = await req.payload.login({
      collection: 'users',
      data: { username: username.trim().toLowerCase(), password },
      context: { twoStep: true },
    })
  } catch (e) {
    const name = (e as Error).name
    if (name === 'LockedAuth') return json({ error: 'บัญชีถูกล็อกชั่วคราว ลองใหม่ในอีก 15 นาที หรือติดต่อผู้ดูแลจังหวัด' }, 423)
    return json({ error: GENERIC }, 401)
  }
  const user = await fullUser(req, result.user!.id)
  if (user.status === 'suspended') return json({ error: 'บัญชีนี้ถูกระงับ ติดต่อผู้ดูแลจังหวัดหรือผู้ดูแลระบบส่วนกลาง' }, 403)
  if (user.status === 'invited') return json({ error: 'บัญชีนี้ยังไม่ได้เปิดใช้ กรุณาใช้ลิงก์เปิดใช้บัญชีที่ได้รับจากผู้ดูแล' }, 403)
  // Unused for INACTIVE_DAYS (365) days: suspend on the spot (the periodic job may not have reached it yet). Central admins are exempt.
  const lastUsed = new Date(user.lastLoginAt ?? user.passwordSetAt ?? user.createdAt).getTime()
  if (user.role !== 'admin' && Date.now() - lastUsed > INACTIVE_DAYS * 24 * 60 * 60 * 1000) {
    await req.payload.update({ collection: 'users', id: user.id, data: { status: 'suspended', suspendedReason: INACTIVE_REASON, sessions: [] } as AnyUser, overrideAccess: true, context: { internal: true } })
    await logActivity(req.payload, { action: 'auto_suspend', area: 'ผู้ใช้', subject: user.username })
    return json({ error: `บัญชีนี้ถูกระงับเพราะไม่ได้เข้าสู่ระบบเกิน ${INACTIVE_DAYS} วัน ติดต่อผู้ดูแลจังหวัดหรือผู้ดูแลระบบส่วนกลาง` }, 403)
  }

  const pending: Pending = { token: result.token!, userId: user.id }
  if (user.totpSecret && user.totpConfirmedAt) return json({ next: 'code', ticket: seal('pending', pending, 300) })

  // First sign-in: start 2FA setup. The secret travels inside the sealed ticket until it is confirmed.
  const secret = newTotpSecret()
  const url = otpauthUrl(secret, user.username)
  return json({
    next: 'setup',
    ticket: seal('pending', { ...pending, setupSecret: secret }, 900),
    secret,
    qr: await QRCode.toDataURL(url, { margin: 1, width: 240 }),
    username: user.username,
  })
}

export const signIn: PayloadHandler = async (req) => {
  const { username, password } = await body(req)
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) return json({ error: GENERIC }, 401)
  return passwordStep(req, username, password)
}

export const signInCode: PayloadHandler = async (req) => {
  const { ticket, code } = await body(req)
  const pending = unseal<Pending>('pending', ticket)
  if (!pending || typeof code !== 'string') return json({ error: 'หมดเวลา กรุณาเข้าสู่ระบบใหม่', restart: true }, 401)
  const user = await fullUser(req, pending.userId)
  if (user.status !== 'active') return json({ error: 'บัญชีนี้ใช้งานไม่ได้', restart: true }, 403)
  if (user.lockUntil && new Date(user.lockUntil).getTime() > Date.now())
    return json({ error: 'บัญชีถูกล็อกชั่วคราว ลองใหม่ในอีก 15 นาที', restart: true }, 423)

  const fail = async () => {
    const attempts = (user.codeAttempts ?? 0) + 1
    const locked = attempts >= MAX_CODE_ATTEMPTS
    await req.payload.db.updateOne({
      collection: 'users',
      id: user.id,
      data: locked ? { codeAttempts: 0, lockUntil: new Date(Date.now() + LOCK_MS).toISOString() } : { codeAttempts: attempts },
    })
    if (locked) await logActivity(req.payload, { action: 'sign_in_locked', area: 'ผู้ใช้', subject: user.username, province: user.provinces?.[0], actor: user as { id: number; username: string } })
    return locked
      ? json({ error: 'กรอกผิดครบ 5 ครั้ง บัญชีถูกล็อก 15 นาที', restart: true }, 423)
      : json({ error: `รหัสไม่ถูกต้อง ลองได้อีก ${MAX_CODE_ATTEMPTS - attempts} ครั้ง` }, 401)
  }

  const update: AnyUser = { codeAttempts: 0, lastLoginAt: new Date().toISOString() }
  let recoveryCodes: string[] | undefined

  if (pending.setupSecret) {
    if (!verifyTotp(pending.setupSecret, code)) return fail()
    recoveryCodes = newRecoveryCodes()
    update.totpSecret = seal('totp', pending.setupSecret)
    update.totpConfirmedAt = new Date().toISOString()
    update.recoveryCodes = recoveryCodes.map((c) => ({ hash: sha256(normalizeRecoveryCode(c)) }))
  } else {
    const secret = unseal<string>('totp', user.totpSecret)
    if (!secret) return json({ error: 'บัญชีนี้ยังไม่ได้ตั้งค่า 2FA กรุณาเข้าสู่ระบบใหม่', restart: true }, 401)
    if (!verifyTotp(secret, code)) {
      // Not a current 6-digit code: maybe an unused recovery code.
      const hash = sha256(normalizeRecoveryCode(code))
      const left = ((user.recoveryCodes ?? []) as { hash: string; usedAt?: string }[]).map((c) => ({ ...c }))
      const match = left.find((c) => c.hash === hash && !c.usedAt)
      if (!match) return fail()
      match.usedAt = new Date().toISOString()
      update.recoveryCodes = left
    }
  }

  await req.payload.update({ collection: 'users', id: user.id, data: update, overrideAccess: true, context: { internal: true } })
  await logActivity(req.payload, { action: 'sign_in', area: 'ผู้ใช้', subject: user.username, province: user.provinces?.[0], actor: user as { id: number; username: string } })
  const cookie = generatePayloadCookie({
    collectionAuthConfig: req.payload.collections.users.config.auth,
    cookiePrefix: req.payload.config.cookiePrefix,
    token: pending.token,
  })
  return json({ ok: true, recoveryCodes }, 200, { 'Set-Cookie': cookie })
}

// ───────────── one-time links (activation / new password) ─────────────

async function findLink(req: PayloadRequest, token: unknown) {
  if (typeof token !== 'string' || token.length < 20) return null
  const res = await req.payload.find({
    collection: 'user-tokens',
    where: { tokenHash: { equals: sha256(token) } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const row = res.docs[0] as AnyUser | undefined
  if (!row || row.usedAt || new Date(row.expiresAt).getTime() < Date.now()) return null
  return row
}

/** GET /api/users/link/:token — lets the page show whose account the link is for, without consuming it. */
export const linkInfo: PayloadHandler = async (req) => {
  const row = await findLink(req, req.routeParams?.token)
  if (!row) return json({ error: 'ลิงก์นี้ใช้ไม่ได้ อาจหมดอายุหรือถูกใช้ไปแล้ว ขอลิงก์ใหม่จากผู้ดูแล' }, 404)
  const user = await fullUser(req, typeof row.user === 'object' ? row.user.id : row.user)
  return json({ username: user.username, name: user.name, purpose: row.purpose })
}

/** POST /api/users/link/:token { password } — set the password, consume the link, continue to 2FA. */
export const useLink: PayloadHandler = async (req) => {
  const row = await findLink(req, req.routeParams?.token)
  if (!row) return json({ error: 'ลิงก์นี้ใช้ไม่ได้ อาจหมดอายุหรือถูกใช้ไปแล้ว ขอลิงก์ใหม่จากผู้ดูแล' }, 404)
  const user = await fullUser(req, typeof row.user === 'object' ? row.user.id : row.user)
  if (user.status === 'suspended') return json({ error: 'บัญชีนี้ถูกระงับ' }, 403)
  const { password } = await body(req)
  const problem = checkPassword(password, user.username)
  if (problem) return json({ error: problem }, 400)

  await req.payload.update({
    collection: 'users',
    id: user.id,
    data: { password, status: 'active', passwordSetAt: new Date().toISOString(), codeAttempts: 0, loginAttempts: 0, lockUntil: null } as AnyUser,
    overrideAccess: true,
    context: { internal: true },
  })
  await req.payload.update({ collection: 'user-tokens', id: row.id, data: { usedAt: new Date().toISOString() }, overrideAccess: true })
  return passwordStep(req, user.username, password)
}

// ───────────── management actions (admins, and managers for their own province's editors) ─────────────

/** May the signed-in user manage this account? */
function canManage(actor: AnyUser | null, target: AnyUser): boolean {
  if (!actor) return false
  if (actor.role === 'admin') return true
  if (actor.role !== 'province_manager' || target.role !== 'province_editor') return false
  const mine = provinceIds(actor)
  const theirs = provinceIds(target)
  return theirs.length > 0 && theirs.every((id) => mine.includes(id))
}

async function target(req: PayloadRequest): Promise<AnyUser | Response> {
  if (!req.user) return json({ error: 'ต้องเข้าสู่ระบบ' }, 401)
  const user = await fullUser(req, req.routeParams?.id as string).catch(() => null)
  if (!user || !canManage(req.user as AnyUser, user)) return json({ error: 'ไม่มีสิทธิ์จัดการบัญชีนี้' }, 403)
  return user
}

/** Create a one-time link token for a user (invalidating earlier unused ones) and return the full URL. */
export async function createLinkFor(
  payload: PayloadRequest['payload'],
  user: AnyUser,
  purpose: 'activation' | 'password_reset',
  origin: string,
  createdBy?: number | string,
) {
  // A new link invalidates any earlier unused link of the same kind.
  const old = await payload.find({
    collection: 'user-tokens',
    where: { and: [{ user: { equals: user.id } }, { purpose: { equals: purpose } }, { usedAt: { exists: false } }] },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  for (const t of old.docs) await payload.delete({ collection: 'user-tokens', id: t.id, overrideAccess: true })

  const token = newLinkToken()
  const hours = purpose === 'activation' ? 14 * 24 : 24
  const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString()
  await payload.create({
    collection: 'user-tokens',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { user: user.id, purpose, tokenHash: sha256(token), expiresAt, createdBy } as any,
    overrideAccess: true,
  })
  return { url: `${origin.replace(/\/$/, '')}/activate/${token}`, expiresAt, purpose, username: user.username as string }
}

export function issueLink(req: PayloadRequest, user: AnyUser, purpose: 'activation' | 'password_reset') {
  // SITE_URL wins when set, so links are right behind a reverse proxy
  const origin = process.env.SITE_URL || req.headers.get('origin') || new URL(req.url ?? 'http://localhost:3000').origin
  return createLinkFor(req.payload, user, purpose, origin, req.user?.id)
}

/** POST /api/users/:id/link — the link is returned once and only its hash is stored. */
export const createLink: PayloadHandler = async (req) => {
  const user = await target(req)
  if (user instanceof Response) return user
  if (user.status === 'suspended') return json({ error: 'บัญชีนี้ถูกระงับ ยกเลิกการระงับก่อน' }, 400)
  await logActivity(req.payload, { action: 'user_link', area: 'ผู้ใช้', subject: user.username, province: user.provinces?.[0], actor: req.user as { id: number; username?: string } })
  return json(await issueLink(req, user, user.status === 'invited' ? 'activation' : 'password_reset'))
}

/** POST /api/users/:id/reset-2fa — the user sets 2FA up again at next sign-in. */
export const resetTwoFactor: PayloadHandler = async (req) => {
  const user = await target(req)
  if (user instanceof Response) return user
  await req.payload.update({
    collection: 'users',
    id: user.id,
    data: { totpSecret: null, totpConfirmedAt: null, recoveryCodes: [], sessions: [] } as AnyUser,
    overrideAccess: true,
    context: { internal: true },
  })
  await logActivity(req.payload, { action: 'user_reset_2fa', area: 'ผู้ใช้', subject: user.username, province: user.provinces?.[0], actor: req.user as { id: number; username?: string } })
  return json({ ok: true })
}

/** POST /api/users/:id/suspend { suspended: boolean, reason? } */
export const setSuspended: PayloadHandler = async (req) => {
  const user = await target(req)
  if (user instanceof Response) return user
  if (user.id === req.user!.id) return json({ error: 'ระงับบัญชีของตัวเองไม่ได้' }, 400)
  const { suspended, reason } = await body(req)
  const data: AnyUser = suspended
    ? { status: 'suspended', suspendedReason: reason || null, sessions: [] }
    : { status: user.passwordSetAt ? 'active' : 'invited', suspendedReason: null }
  await req.payload.update({ collection: 'users', id: user.id, data, overrideAccess: true, context: { internal: true } })
  await logActivity(req.payload, { action: suspended ? 'user_suspend' : 'user_unsuspend', area: 'ผู้ใช้', subject: user.username, province: user.provinces?.[0], actor: req.user as { id: number; username?: string } })
  return json({ ok: true, status: data.status })
}

/** Create one account in the "invited" state; nobody ever knows its placeholder password. */
export async function inviteUser(req: PayloadRequest, input: AnyUser) {
  const actor = req.user as AnyUser
  const role = actor.role === 'admin' ? input.role : 'province_editor'
  const provinces = actor.role === 'admin' ? (input.provinces ?? []) : provinceIds(actor)
  const user = await req.payload.create({
    collection: 'users',
    data: {
      username: String(input.username ?? '').trim().toLowerCase(),
      name: input.name,
      nameEn: String(input.nameEn ?? '').trim().replace(/\s+/g, ' ') || undefined,
      position: input.position || undefined,
      phone: input.phone || undefined,
      email: input.email || undefined,
      role,
      provinces: role === 'admin' ? [] : provinces,
      password: randomPassword(),
      status: 'invited',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    overrideAccess: true,
    context: { internal: true },
  })
  await logActivity(req.payload, { action: 'user_invite', area: 'ผู้ใช้', subject: user.username, province: provinces[0], actor: actor as { id: number; username?: string } })
  return { user, link: await issueLink(req, user, 'activation') }
}

/** GET /api/users/usernames?u=a,b,c — which of these usernames are already taken. For the add-user form. */
export const usernamesTaken: PayloadHandler = async (req) => {
  const actor = req.user as AnyUser | null
  if (!actor || !['admin', 'province_manager'].includes(actor.role)) return json({ error: 'ไม่มีสิทธิ์' }, 403)
  const asked = String(req.searchParams?.get('u') ?? '')
    .split(',')
    .map((u) => u.trim().toLowerCase())
    .filter((u) => /^[a-z0-9][a-z0-9._-]{0,31}$/.test(u))
    .slice(0, 12)
  if (!asked.length) return json({ taken: [] })
  const found = await req.payload.find({ collection: 'users', where: { username: { in: asked } }, limit: asked.length, depth: 0, overrideAccess: true, select: { username: true } })
  return json({ taken: found.docs.map((d) => (d as AnyUser).username) })
}

/** POST /api/users/invite */
export const invite: PayloadHandler = async (req) => {
  const actor = req.user as AnyUser | null
  if (!actor || !['admin', 'province_manager'].includes(actor.role)) return json({ error: 'ไม่มีสิทธิ์เพิ่มผู้ใช้' }, 403)
  try {
    const input = await body(req)
    const bad = checkAll(input, {
      username: { rule: 'username' },
      name: { rule: 'name' },
      nameEn: { rule: 'nameEn', required: false },
      position: { rule: 'text', required: false },
      phone: { rule: 'phone', required: false },
      email: { rule: 'email', required: false },
    })
    const firstBad = Object.keys(bad)[0]
    if (firstBad) return json({ error: bad[firstBad], field: firstBad }, 400)
    if (input.phone) input.phone = phoneDigits(input.phone)
    const { user, link } = await inviteUser(req, input)
    // made from a "ขอบัญชี" request: mark that request approved
    if (Number(input.requestId)) await markApproved(req, Number(input.requestId), user.id)
    return json({ id: user.id, ...link })
  } catch (e) {
    const err = e as { data?: { errors?: { message: string; path?: string }[] }; message: string }
    return json({ error: err.data?.errors?.map((x) => `${x.path ?? ''} ${x.message}`.trim()).join(', ') || err.message }, 400)
  }
}
