/**
 * Removes the "รอตรวจ" mark from imported dashboards that no longer have anything to check: they have a
 * title, a dashboard link, a fiscal year and a topic (the import marked them because one of these was
 * missing; most only lacked a topic, since given by assign-dashboard-topics.ts). Run after that script,
 * also on the real server after importing. DRY=1 only lists them.
 *
 *   npx payload run scripts/clear-resolved-review.ts
 */
import config from '@payload-config'
import { sql } from '@payloadcms/db-postgres'
import { getPayload } from 'payload'

import { logActivity } from '../src/lib/activity'

const dry = process.env.DRY === '1'
const payload = await getPayload({ config })
const db = payload.db.drizzle

const rows = (
  await db.execute(sql`
    select id, title, province_id from dashboards
    where needs_review and deleted_at is null
      and coalesce(title, '') <> '' and coalesce(embed_url, '') <> '' and fiscal_year is not null and topic_id is not null
    order by id`)
).rows as { id: number; title: string; province_id: number }[]

for (const r of rows) {
  console.log(`${dry ? '[dry] ' : ''}#${r.id} ${r.title}`)
  if (dry) continue
  await db.execute(sql`update dashboards set needs_review = false where id = ${r.id}`)
  await db.execute(sql`update _dashboards_v set version_needs_review = false where parent_id = ${r.id} and latest = true`)
  await logActivity(payload, { action: 'update', area: 'แดชบอร์ด', subject: `ตรวจแล้ว (ข้อมูลครบ): ${r.title}`, province: r.province_id })
}
const left = (await db.execute(sql`select count(*)::int as n from dashboards where needs_review and deleted_at is null`)).rows[0] as { n: number }
console.log(`${dry ? 'would clear' : 'cleared'} ${rows.length}; still to check: ${dry ? left.n - rows.length : left.n}`)
process.exit(0)
