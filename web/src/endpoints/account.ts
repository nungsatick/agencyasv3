import type { PayloadHandler, PayloadRequest } from 'payload'
import QRCode from 'qrcode'

import { logActivity } from '../lib/activity'
import { checkPassword, newRecoveryCodes, newTotpSecret, normalizeRecoveryCode, otpauthUrl, seal, sha256, unseal, verifyTotp } from '../lib/auth'

// Self-service account actions for the signed-in user ("บัญชีของฉัน").
// Every sensitive change asks for proof again: the current password, or a current 2FA code.

type AnyUser = Record<string, any>
const json = (body: unknown, status = 200) => Response.json(body, { status })
const body = async (req: PayloadRequest): Promise<Record<string, any>> => (req.json ? await req.json().catch(() => ({})) : {})

async function me(req: PayloadRequest): Promise<AnyUser | null> {
  if (!req.user) return null
  return req.payload.findByID({ collection: 'users', id: req.user.id, depth: 0, showHiddenFields: true, overrideAccess: true })
}

/** True when `password` is the user's current password. Wrong tries count towards the normal lockout. */
async function passwordOk(req: PayloadRequest, user: AnyUser, password: unknown): Promise<boolean> {
  if (typeof password !== 'string' || !password) return false
  try {
    await req.payload.login({ collection: 'users', data: { username: user.username, password }, context: { twoStep: true } })
    return true
  } catch {
    return false
  }
}

const recoveryRows = (codes: string[]) => codes.map((c) => ({ hash: sha256(normalizeRecoveryCode(c)) }))

/** POST /api/users/account/password { current, next } */
export const changeOwnPassword: PayloadHandler = async (req) => {
  const user = await me(req)
  if (!user) return json({ error: 'ต้องเข้าสู่ระบบ' }, 401)
  const { current, next } = await body(req)
  if (!(await passwordOk(req, user, current))) return json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }, 400)
  const problem = checkPassword(next, user.username)
  if (problem) return json({ error: problem }, 400)
  if (next === current) return json({ error: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน' }, 400)
  await req.payload.update({
    collection: 'users',
    id: user.id,
    data: { password: next, passwordSetAt: new Date().toISOString() } as AnyUser,
    overrideAccess: true,
    context: { internal: true },
  })
  await logActivity(req.payload, { action: 'password_change', area: 'ผู้ใช้', subject: user.username, province: user.provinces?.[0], actor: user as { id: number; username: string } })
  return json({ ok: true })
}

/** POST /api/users/account/2fa/start { password } — begin moving 2FA to another phone. */
export const startOwnTwoFactor: PayloadHandler = async (req) => {
  const user = await me(req)
  if (!user) return json({ error: 'ต้องเข้าสู่ระบบ' }, 401)
  const { password } = await body(req)
  if (!(await passwordOk(req, user, password))) return json({ error: 'รหัสผ่านไม่ถูกต้อง' }, 400)
  const secret = newTotpSecret()
  return json({
    ticket: seal('totp-setup', { userId: user.id, secret }, 900),
    secret,
    qr: await QRCode.toDataURL(otpauthUrl(secret, user.username), { margin: 1, width: 240 }),
  })
}

/** POST /api/users/account/2fa/confirm { ticket, code } — the old phone and old recovery codes stop working. */
export const confirmOwnTwoFactor: PayloadHandler = async (req) => {
  const user = await me(req)
  if (!user) return json({ error: 'ต้องเข้าสู่ระบบ' }, 401)
  const { ticket, code } = await body(req)
  const pending = unseal<{ userId: number; secret: string }>('totp-setup', ticket)
  if (!pending || pending.userId !== user.id) return json({ error: 'หมดเวลา กรุณาเริ่มใหม่' }, 400)
  if (typeof code !== 'string' || !verifyTotp(pending.secret, code)) return json({ error: 'รหัสไม่ถูกต้อง' }, 400)
  const codes = newRecoveryCodes()
  await req.payload.update({
    collection: 'users',
    id: user.id,
    data: { totpSecret: seal('totp', pending.secret), totpConfirmedAt: new Date().toISOString(), recoveryCodes: recoveryRows(codes) } as AnyUser,
    overrideAccess: true,
    context: { internal: true },
  })
  return json({ ok: true, recoveryCodes: codes })
}

/** POST /api/users/account/recovery-codes { code } — a fresh set; the previous set stops working. */
export const renewOwnRecoveryCodes: PayloadHandler = async (req) => {
  const user = await me(req)
  if (!user) return json({ error: 'ต้องเข้าสู่ระบบ' }, 401)
  const { code } = await body(req)
  const secret = unseal<string>('totp', user.totpSecret)
  if (!secret || typeof code !== 'string' || !verifyTotp(secret, code)) return json({ error: 'รหัส 6 หลักไม่ถูกต้อง' }, 400)
  const codes = newRecoveryCodes()
  await req.payload.update({
    collection: 'users',
    id: user.id,
    data: { recoveryCodes: recoveryRows(codes) } as AnyUser,
    overrideAccess: true,
    context: { internal: true },
  })
  return json({ ok: true, recoveryCodes: codes })
}

/** GET /api/users/account — what the account screen shows (never the secrets themselves). */
export const ownAccount: PayloadHandler = async (req) => {
  const user = await me(req)
  if (!user) return json({ error: 'ต้องเข้าสู่ระบบ' }, 401)
  const codes = (user.recoveryCodes ?? []) as { usedAt?: string }[]
  return json({
    username: user.username,
    name: user.name,
    twoFactorSince: user.totpConfirmedAt ?? null,
    passwordSetAt: user.passwordSetAt ?? null,
    recoveryCodesLeft: codes.filter((c) => !c.usedAt).length,
  })
}
