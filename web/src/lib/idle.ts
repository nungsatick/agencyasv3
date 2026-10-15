import { sql } from '@payloadcms/db-postgres'
import { type AuthStrategy, JWTAuthentication, type Payload, type PayloadHandler } from 'payload'

import { logActivity } from './activity'

/** Backoffice sessions end after this long without the person using the screen (on top of the 8-hour limit). */
export const IDLE_MINUTES = 30
const IDLE_MS = IDLE_MINUTES * 60 * 1000

type SessionUser = { id: number; username?: string; _sid?: string }

const lastSeen = async (payload: Payload, sid: string): Promise<number | null> => {
  const row = (await payload.db.drizzle.execute(sql`select last_seen from session_activity where sid = ${sid}`)).rows[0] as { last_seen: string | Date } | undefined
  return row ? new Date(row.last_seen).getTime() : null
}

/** Mark a session as in use now (the person clicked, typed or scrolled, or has just signed in). */
export async function touchSession(payload: Payload, sid: string, userId: number): Promise<void> {
  await payload.db.drizzle.execute(sql`
    insert into session_activity (sid, user_id, last_seen, updated_at, created_at) values (${sid}, ${userId}, now(), now(), now())
    on conflict (sid) do update set last_seen = now(), updated_at = now()`)
}

/**
 * Runs before Payload's own sign-in check on every request. A session nobody has used for IDLE_MINUTES
 * is removed from the account, so the cookie stops working everywhere (Payload's own check then finds no
 * session). "Used" means real activity reported by the screen (see /api/users/activity), not background
 * requests, so a screen left open does not keep itself signed in.
 */
export const idleSessionStrategy: AuthStrategy = {
  name: 'idle-session',
  authenticate: async (args) => {
    const result = await JWTAuthentication(args)
    const user = result.user as SessionUser | null
    if (!user?._sid) return { user: null } // not signed in: nothing to decide here
    const seen = await lastSeen(args.payload, user._sid)
    if (seen === null) {
      // first request of a new session
      await touchSession(args.payload, user._sid, user.id)
      return result
    }
    if (Date.now() - seen <= IDLE_MS) return result
    await args.payload.db.drizzle.execute(sql`delete from users_sessions where id = ${user._sid}`)
    await args.payload.db.drizzle.execute(sql`delete from session_activity where sid = ${user._sid}`)
    await logActivity(args.payload, { action: 'idle_sign_out', area: 'ผู้ใช้', subject: user.username ?? String(user.id), actor: { id: user.id, username: user.username } })
    return { user: null }
  },
}

/** POST /api/users/activity — the screen reports that the person is using it. */
export const reportActivity: PayloadHandler = async (req) => {
  const user = req.user as SessionUser | null
  if (!user?._sid) return Response.json({ error: 'ต้องเข้าสู่ระบบ' }, { status: 401 })
  await touchSession(req.payload, user._sid, user.id)
  return Response.json({ ok: true, idleMinutes: IDLE_MINUTES })
}

/** Rows of sessions that ended long ago (signed out, expired or cut for idleness). */
export async function forgetOldSessions(payload: Payload): Promise<void> {
  await payload.db.drizzle.execute(sql`delete from session_activity where last_seen < now() - interval '1 day'`)
}
