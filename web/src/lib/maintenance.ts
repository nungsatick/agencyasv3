import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { logActivity } from './activity'
import { forgetOldSessions } from './idle'

export const INACTIVE_DAYS = 365
/** From this many days without signing in, the users list warns that the account will be suspended (90 days ahead). */
export const INACTIVE_WARN_DAYS = INACTIVE_DAYS - 90
export const TRASH_DAYS = 30
const DAY = 24 * 60 * 60 * 1000

export const INACTIVE_REASON = `ไม่ได้เข้าสู่ระบบเกิน ${INACTIVE_DAYS} วัน (ระบบระงับอัตโนมัติ)`

type Row = { id: number; username: string }

/**
 * Suspend active accounts that have not signed in for INACTIVE_DAYS (365) days (counted from the last sign-in,
 * or from when the password was set for accounts that never signed in).
 * Central admins are left alone: suspending the last admin would lock everyone out.
 */
export async function suspendInactive(payload: Payload, now = new Date()): Promise<Row[]> {
  const cutoff = new Date(now.getTime() - INACTIVE_DAYS * DAY).toISOString()
  const res = await payload.db.drizzle.execute(sql`
    update users set status = 'suspended', suspended_reason = ${INACTIVE_REASON}, updated_at = now()
    where status = 'active' and role <> 'admin'
      and coalesce(last_login_at, password_set_at, created_at) < ${cutoff}
    returning id, username`)
  const rows = res.rows as Row[]
  for (const r of rows) {
    // end any session that is still open
    await payload.db.drizzle.execute(sql`delete from users_sessions where _parent_id = ${r.id}`)
    await logActivity(payload, { action: 'auto_suspend', area: 'ผู้ใช้', subject: r.username })
  }
  return rows
}

/** Permanently delete documents and dashboards that have been in the trash for more than 30 days. */
export async function purgeTrash(payload: Payload, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - TRASH_DAYS * DAY).toISOString()
  let n = 0
  for (const collection of ['documents', 'dashboards'] as const) {
    const res = await payload.delete({
      collection,
      where: { deletedAt: { less_than: cutoff } },
      trash: true,
      overrideAccess: true,
      context: { maintenance: true },
    })
    n += res.docs.length
  }
  return n
}

export async function runMaintenance(payload: Payload): Promise<void> {
  await forgetOldSessions(payload).catch(() => undefined)
  try {
    const suspended = await suspendInactive(payload)
    const purged = await purgeTrash(payload)
    if (suspended.length || purged) payload.logger.info(`maintenance: suspended ${suspended.length} inactive account(s), purged ${purged} trashed item(s)`)
  } catch (err) {
    payload.logger.error({ err }, 'maintenance failed')
  }
}

/** Run shortly after start-up and then every 6 hours, once per process. */
export function scheduleMaintenance(payload: Payload): void {
  const g = globalThis as { __agyMaintenance?: boolean }
  if (g.__agyMaintenance) return
  g.__agyMaintenance = true
  setTimeout(() => void runMaintenance(payload), 60 * 1000).unref()
  setInterval(() => void runMaintenance(payload), 6 * 60 * 60 * 1000).unref()
}
