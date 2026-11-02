import type { Where } from 'payload'

import { INACTIVE_WARN_DAYS } from './maintenance'

const DAY_MS = 86_400_000

/** The filters of the users list; ?q= ?role= ?status= ?province= ?no2fa=1 ?idle=1. Shared with its Excel export. */
export function usersListWhere(sp: Record<string, string | undefined>): Where[] {
  const and: Where[] = []
  if (sp.q) and.push({ or: [{ username: { like: sp.q } }, { name: { like: sp.q } }, { email: { like: sp.q } }] })
  if (sp.role) and.push({ role: { equals: sp.role } })
  if (sp.status) and.push({ status: { equals: sp.status } })
  // central admins are not province staff (old accounts may still carry a province from an earlier role)
  if (sp.province) and.push({ provinces: { in: [Number(sp.province)] } }, { role: { not_equals: 'admin' } })
  if (sp.no2fa === '1') and.push({ totpConfirmedAt: { exists: false } })
  // accounts that will be suspended within 90 days (same clock as lib/maintenance.ts)
  const warnFrom = new Date(Date.now() - INACTIVE_WARN_DAYS * DAY_MS).toISOString()
  if (sp.idle === '1')
    and.push(
      { status: { equals: 'active' } },
      { role: { not_equals: 'admin' } },
      { or: [{ lastLoginAt: { less_than: warnFrom } }, { and: [{ lastLoginAt: { exists: false } }, { passwordSetAt: { less_than: warnFrom } }] }] },
    )
  return and
}

/** The export link for the filters currently on screen. */
export function usersExportHref(sp: Record<string, string | undefined>): string {
  const q = new URLSearchParams()
  for (const key of ['q', 'role', 'status', 'province', 'no2fa', 'idle']) if (sp[key]) q.set(key, sp[key]!)
  const s = q.toString()
  return `/api/users/export${s ? `?${s}` : ''}`
}
