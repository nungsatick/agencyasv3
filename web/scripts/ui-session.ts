/**
 * Development aid for looking at backoffice screens: creates (or reuses) the throwaway central
 * admin "zz-test-ui", signs it in through the normal two-step sign-in and writes the session
 * cookie to the file given as UI_COOKIE_FILE. Remove the account afterwards with REMOVE=1.
 * Dev only; never run against a real installation.
 *
 *   UI_COOKIE_FILE=/path/cookie.txt npx payload run scripts/ui-session.ts
 *   UI_ROLE=province_manager UI_PROVINCE=kalasin ...   (sign in as a province role instead)
 *   REMOVE=1 npx payload run scripts/ui-session.ts
 */
import config from '@payload-config'
import fs from 'fs'
import { getPayload } from 'payload'

import { randomPassword, totpAt } from '../src/lib/auth'

const BASE = process.env.CHECK_BASE_URL ?? 'http://localhost:3000'
const USERNAME = 'zz-test-ui'
const payload = await getPayload({ config })
const existing = (await payload.find({ collection: 'users', where: { username: { equals: USERNAME } }, limit: 1, depth: 0 })).docs[0]

if (process.env.REMOVE === '1') {
  if (existing) await payload.delete({ collection: 'users', id: existing.id })
  await payload.db.drizzle.execute(`delete from activity_logs where username = '${USERNAME}' or subject = '${USERNAME}'` as never)
  console.log('removed')
  process.exit(0)
}

// a fresh password each run; nobody needs to know it
const role = process.env.UI_ROLE ?? 'admin'
const provinces =
  role === 'admin' ? [] : (await payload.find({ collection: 'provinces', where: { slug: { equals: process.env.UI_PROVINCE ?? 'kalasin' } }, limit: 1, depth: 0 })).docs.map((p) => p.id)
const password = randomPassword()
if (existing) await payload.delete({ collection: 'users', id: existing.id })
await payload.create({
  collection: 'users',
  data: { username: USERNAME, name: `ทดสอบหน้าจอ ${role === 'admin' ? 'ส่วนกลาง' : 'จังหวัด'}`, role, provinces, password, status: 'active' } as never,
  context: { internal: true },
})
const post = (path: string, body: unknown) =>
  fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE }, body: JSON.stringify(body) })
const one = await (await post('/api/users/sign-in', { username: USERNAME, password })).json()
const two = await post('/api/users/sign-in/code', { ticket: one.ticket, code: totpAt(one.secret) })
const cookie = (two.headers.get('set-cookie') ?? '').split(';')[0]
if (!cookie.startsWith('payload-token=')) throw new Error('sign-in failed')
fs.writeFileSync(process.env.UI_COOKIE_FILE!, cookie.slice('payload-token='.length))
console.log('signed in; cookie written')
process.exit(0)
