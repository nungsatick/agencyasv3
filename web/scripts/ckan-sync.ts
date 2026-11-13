/**
 * Refreshes the copy of the provinces' datasets from the CKAN portals now (the server also does it every night).
 *   npx payload run scripts/ckan-sync.ts
 */
import config from '@payload-config'
import { getPayload } from 'payload'

import { syncCkan } from '../src/lib/ckanSync'

const payload = await getPayload({ config })
const results = await syncCkan(payload)
if (!results) console.log('กำลังดึงข้อมูลอยู่แล้ว (อีกกระบวนการหนึ่ง)')
else for (const r of results) console.log(`${r.source}: ${r.status}, ${r.fetched} รายการ, นำออก ${r.removed} · ${r.note}`)
process.exit(results?.every((r) => r.status === 'ok') ? 0 : 1)
