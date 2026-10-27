import { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'

/**
 * The files that belong to some provinces. Files carry no province of their own, so a file counts as a
 * province's when it is attached to one of its documents or dashboards (file or cover picture), is its header
 * picture, came from its page on the old site (uploads/content/<slug>/…), or was uploaded by one of its staff.
 * Used for what province staff may see in "ไฟล์" and which files they may change.
 */
export async function provinceFileIds(payload: Payload, provinces: number[]): Promise<number[]> {
  if (!provinces.length) return []
  const ids = sql.join(provinces.map((id) => sql`${id}`), sql`, `)
  const rows = (
    await payload.db.drizzle.execute(sql`
      with mine as (
        select r.files_id as id from documents_rels r join documents d on d.id = r.parent_id where r.files_id is not null and d.province_id in (${ids})
        union select b.thumbnail_id from dashboards b where b.thumbnail_id is not null and b.province_id in (${ids})
        union select r.files_id from dashboards_rels r join dashboards b on b.id = r.parent_id where r.files_id is not null and b.province_id in (${ids})
        union select p.hero_image_id from provinces p where p.hero_image_id is not null and p.id in (${ids})
        union select f.id from files f join provinces p on f.public_path like 'uploads/content/' || p.slug || '/%' where p.id in (${ids})
        -- (not central admins: an admin account may still carry a province from an earlier role)
        union select f.id from files f join users_rels u on u.parent_id = f.uploaded_by_id join users a on a.id = f.uploaded_by_id
          where u.path = 'provinces' and u.provinces_id in (${ids}) and a.role <> 'admin'
      )
      -- with the earlier versions of those files (kept when a file is replaced)
      select id from mine union select f.id from files f join mine m on f.version_of_id = m.id`)
  ).rows as { id: number }[]
  return [...new Set(rows.map((r) => Number(r.id)))]
}

/** The same list, worked out once per request (access checks ask for it several times). */
export async function myProvinceFileIds(req: PayloadRequest, provinces: number[]): Promise<number[]> {
  const key = `provinceFiles:${provinces.join(',')}`
  const memo = req.context as Record<string, unknown>
  if (!memo[key]) memo[key] = provinceFileIds(req.payload, provinces)
  return (await memo[key]) as number[]
}
