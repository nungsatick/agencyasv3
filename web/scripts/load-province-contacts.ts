/**
 * Puts each provincial statistics office's address, phone, fax and @nso.mail.go.th e-mail from
 * migration/import/province_contacts.json (built by migration/build_province_contacts.py from the
 * NSO intranet phonebook) into the provinces, which the site footer shows.
 * An e-mail the phonebook does not have is left as it is.
 *
 *   npx payload run scripts/load-province-contacts.ts
 */
import config from '@payload-config'
import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'

type Contact = { slug: string; name_th: string; address: string | null; phone: string | null; fax: string | null; email: string | null }

const payload = await getPayload({ config })
const contacts = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), '../migration/import/province_contacts.json'), 'utf8')) as Contact[]

let changed = 0
for (const c of contacts) {
  const p = (await payload.find({ collection: 'provinces', where: { slug: { equals: c.slug } }, limit: 1, depth: 0 })).docs[0]
  if (!p) {
    console.log(`not found: ${c.slug}`)
    continue
  }
  const data: Record<string, string | null> = { address: c.address, phone: c.phone, fax: c.fax }
  if (c.email) data.email = c.email
  const diff = Object.entries(data).filter(([k, v]) => (p as unknown as Record<string, unknown>)[k] !== v)
  if (!diff.length) continue
  await payload.update({ collection: 'provinces', id: p.id, data })
  changed++
  console.log(`${c.name_th}: ${diff.map(([k]) => k).join(', ')}`)
}
console.log(`\nupdated ${changed} of ${contacts.length} provinces`)
process.exit(0)
