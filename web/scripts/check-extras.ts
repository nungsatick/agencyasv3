/**
 * End-to-end check of the later additions, against the running dev server (http://localhost:3000):
 * per-item view/download counters, standard titles, activity log, automatic suspension and trash
 * purge, Excel export, the backoffice statistics and review screens, GIF uploads kept byte-for-byte.
 * Everything it creates is named "zz-test" / "ZZ-TEST" and removed afterwards; counters are put back.
 *
 *   npx payload run scripts/check-extras.ts
 */
import { sql } from '@payloadcms/db-postgres'
import config from '@payload-config'
import assert from 'assert'
import crypto from 'crypto'
import ExcelJS from 'exceljs'
import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'

import { storageDir } from '../src/collections/Content'
import { randomPassword, totpAt } from '../src/lib/auth'
import { purgeTrash, suspendInactive } from '../src/lib/maintenance'

const BASE = process.env.CHECK_BASE_URL ?? 'http://localhost:3000'
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
const payload = await getPayload({ config })
const db = payload.db.drizzle
const DAY = 86400000

const one = async <T = Record<string, unknown>>(q: ReturnType<typeof sql>) => (await db.execute(q)).rows[0] as T | undefined
const hits = async (kind: string, id: number) => Number((await one<{ hits: number }>(sql`select hits::int as hits from hit_counts where kind = ${kind} and ref_id = ${id}`))?.hits ?? 0)
const logged = async (action: string, subject: string) =>
  Number((await one<{ n: number }>(sql`select count(*)::int as n from activity_logs where action::text = ${action} and subject = ${subject}`))?.n ?? 0)
const post = (p: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': BROWSER, Origin: BASE, ...headers }, body: JSON.stringify(body) })

async function signIn(username: string, password: string) {
  const a = await post('/api/users/sign-in', { username, password })
  const first = await a.json()
  if (a.status !== 200) return { status: a.status, error: first.error as string, cookie: '' }
  const b = await post('/api/users/sign-in/code', { ticket: first.ticket, code: totpAt(first.secret) })
  assert.equal(b.status, 200)
  return { status: 200, error: '', cookie: (b.headers.get('set-cookie') ?? '').split(';')[0] }
}

const hitsBefore = (await db.execute(sql`select kind::text as kind, ref_id, hits from hit_counts`)).rows as { kind: string; ref_id: number; hits: number }[]
const made = { docs: [] as number[], files: [] as number[] }

const cleanup = async () => {
  for (const id of made.docs.splice(0)) await payload.delete({ collection: 'documents', id, trash: true }).catch(() => undefined)
  for (const id of made.files.splice(0)) await payload.delete({ collection: 'files', id }).catch(() => undefined)
  const strayDash = await payload.find({ collection: 'dashboards', where: { title: { like: 'ZZ-TEST' } }, trash: true, limit: 50, depth: 0, draft: true })
  for (const d of strayDash.docs) await payload.delete({ collection: 'dashboards', id: d.id, trash: true }).catch(() => undefined)
  const strayTopics = await payload.find({ collection: 'topics', where: { nameTh: { like: 'ZZ-TEST' } }, limit: 20, depth: 0 })
  for (const t of strayTopics.docs) {
    await db.execute(sql`update documents set topic_id = null where topic_id = ${t.id}`)
    await db.execute(sql`update dashboards set topic_id = null where topic_id = ${t.id}`)
    await payload.delete({ collection: 'topics', id: t.id }).catch(() => undefined)
  }
  const stray = await payload.find({ collection: 'documents', where: { title: { like: 'ZZ-TEST' } }, trash: true, limit: 50, depth: 0, draft: true })
  for (const d of stray.docs) await payload.delete({ collection: 'documents', id: d.id, trash: true }).catch(() => undefined)
  const users = await payload.find({ collection: 'users', where: { username: { like: 'zz-test-' } }, limit: 100, depth: 0 })
  for (const u of users.docs) await payload.delete({ collection: 'users', id: u.id })
  await db.execute(sql`delete from activity_logs where username like 'zz-test-%' or subject like 'zz-test-%' or subject like 'ZZ-TEST%' or subject like 'รวม "ZZ-TEST%'`)
  // put the counters back exactly as they were
  await db.execute(sql`delete from hit_counts`)
  for (const h of hitsBefore) await db.execute(sql`insert into hit_counts (kind, ref_id, hits, updated_at, created_at) values (${h.kind}, ${h.ref_id}, ${h.hits}, now(), now())`)
}

try {
  await cleanup()
  const loei = (await payload.find({ collection: 'provinces', where: { slug: { equals: 'loei' } }, limit: 1, depth: 0 })).docs[0]
  const docs = (await payload.find({ collection: 'documents', where: { and: [{ province: { equals: loei.id } }, { _status: { equals: 'published' } }] }, limit: 50, depth: 1 })).docs
  const withFile = docs.find((d) => Array.isArray(d.files) && d.files.length && typeof d.files[0] === 'object' && (d.files[0] as { publicPath?: string }).publicPath)!
  const file = (withFile.files as { id: number; publicPath: string }[])[0]
  const fileUrl = BASE + '/' + file.publicPath

  // 1. file counters: a plain open is a download, "?view=1" a view; robots, staff and follow-up ranges are not counted
  const [d0, v0] = [await hits('file_download', file.id), await hits('file_view', file.id)]
  const get = async (url: string, headers: Record<string, string> = {}) => {
    const r = await fetch(url, { headers: { 'User-Agent': BROWSER, ...headers } })
    await r.arrayBuffer()
    return r.status
  }
  assert.equal(await get(fileUrl), 200)
  assert.equal(await get(fileUrl + '?view=1'), 200)
  assert.equal(await get(fileUrl + '?view=1', { Range: 'bytes=0-' }), 200)
  await get(fileUrl, { 'User-Agent': 'Googlebot/2.1' })
  await get(fileUrl, { Cookie: 'payload-token=abc' })
  await get(fileUrl, { Range: 'bytes=4096-' })
  assert.equal(await hits('file_download', file.id), d0 + 1, 'one download')
  assert.equal(await hits('file_view', file.id), v0 + 2, 'two views')

  // 2. link / dashboard counters: published items only
  const dash = (await payload.find({ collection: 'dashboards', where: { _status: { equals: 'published' } }, limit: 1, depth: 0 })).docs[0]
  const draft = (await payload.find({ collection: 'documents', where: { _status: { equals: 'draft' } }, limit: 1, depth: 0, draft: true })).docs[0]
  const [l0, b0] = [await hits('doc_link', withFile.id), await hits('dashboard_view', dash.id)]
  assert.equal((await post('/hit', { kind: 'doc_link', id: withFile.id })).status, 204)
  assert.equal((await post('/hit', { kind: 'dashboard_view', id: dash.id })).status, 204)
  assert.equal((await post('/hit', { kind: 'dashboard_view', id: dash.id }, { 'User-Agent': 'curl/8' })).status, 204)
  assert.equal((await post('/hit', { kind: 'doc_link', id: draft.id })).status, 204)
  assert.equal((await post('/hit', { kind: 'nope', id: 1 })).status, 400)
  assert.equal(await hits('doc_link', withFile.id), l0 + 1)
  assert.equal(await hits('dashboard_view', dash.id), b0 + 1)
  assert.equal(await hits('doc_link', draft.id), 0, 'drafts are not counted')

  // 3. the public pages show per-item numbers and search, and no site-wide visit numbers
  const page = async (p: string) => (await fetch(BASE + p, { headers: { 'User-Agent': BROWSER }, cache: 'no-store' })).text()
  const docsHtml = await page(`/loei/docs?year=${withFile.fiscalYear}`)
  assert.match(docsHtml, /hit-stats/)
  assert.match(docsHtml, /id="doc-search"/)
  assert.doesNotMatch(docsHtml, /คัดลอกลิงก์/)
  assert.match(docsHtml, /class="jump"/)
  assert.match(docsHtml, /sec__head/)
  assert.match(docsHtml, /display-tools/)
  assert.doesNotMatch(await page('/loei'), /visit-stats|สถิติการเข้าชม/)
  assert.match(await page('/loei/utilization'), /hit-stats/)

  // 4. an empty title becomes the standard one
  const types = (await payload.find({ collection: 'document-types', limit: 50, depth: 0 })).docs
  const meeting = types.find((t) => t.code === 'meeting_report')!
  const adminPw = randomPassword()
  const admin = await payload.create({ collection: 'users', data: { username: 'zz-test-extras', name: 'ทดสอบ', role: 'admin', password: adminPw, status: 'active' } as never, context: { internal: true } })
  const doc = await payload.create({
    collection: 'documents',
    draft: true,
    data: { province: loei.id, fiscalYear: 2569, type: meeting.id, title: '', meetingNo: 7, description: 'ZZ-TEST' } as never,
    user: admin,
  })
  made.docs.push(doc.id)
  assert.equal(doc.title, `${meeting.nameTh} ครั้งที่ 7/2569`)

  // 5. activity log: content changes by a signed-in person are recorded
  await payload.update({ collection: 'documents', id: doc.id, data: { title: 'ZZ-TEST เอกสาร' }, user: admin, draft: true })
  assert.equal(await logged('create', doc.title), 1)
  assert.equal(await logged('update', 'ZZ-TEST เอกสาร'), 1)
  await payload.update({ collection: 'documents', id: doc.id, data: { deletedAt: new Date().toISOString() }, user: admin })
  assert.equal(await logged('trash', 'ZZ-TEST เอกสาร'), 1)

  // 6. trash: emptied after 30 days, not before
  assert.equal(await purgeTrash(payload), 0)
  await db.execute(sql`update documents set deleted_at = ${new Date(Date.now() - 31 * DAY).toISOString()} where id = ${doc.id}`)
  assert.equal(await purgeTrash(payload), 1)
  made.docs.pop()
  assert.equal((await payload.find({ collection: 'documents', where: { id: { equals: doc.id } }, trash: true, draft: true })).totalDocs, 0)
  assert.equal(await logged('auto_purge', 'ZZ-TEST เอกสาร'), 1)

  // 7. accounts unused for 365 days are suspended; central admins and recent accounts are not
  const editorPw = randomPassword()
  const mk = (username: string, role: string) =>
    payload.create({ collection: 'users', data: { username, name: 'ทดสอบ', role, provinces: role === 'admin' ? [] : [loei.id], password: role === 'province_editor' ? editorPw : randomPassword(), status: 'active' } as never, context: { internal: true } })
  const [oldEditor, recentEditor, oldAdmin] = [await mk('zz-test-old', 'province_editor'), await mk('zz-test-recent', 'province_editor'), await mk('zz-test-oldadmin', 'admin')]
  const long = new Date(Date.now() - 366 * DAY).toISOString()
  const age = (id: number, when: string) => db.execute(sql`update users set created_at = ${when}, password_set_at = ${when}, last_login_at = null where id = ${id}`)
  await age(oldEditor.id, long)
  await age(oldAdmin.id, long)
  await db.execute(sql`update users set created_at = ${long}, password_set_at = ${long}, last_login_at = ${new Date(Date.now() - 10 * DAY).toISOString()} where id = ${recentEditor.id}`)
  const suspended = (await suspendInactive(payload)).map((r) => r.username)
  assert.deepEqual(suspended, ['zz-test-old'])
  const status = async (id: number) => (await payload.findByID({ collection: 'users', id, depth: 0 })).status
  assert.equal(await status(oldEditor.id), 'suspended')
  assert.equal(await status(recentEditor.id), 'active')
  assert.equal(await status(oldAdmin.id), 'active')
  assert.equal(await logged('auto_suspend', 'zz-test-old'), 1)
  // the same rule at the sign-in door, for an account the periodic job has not reached yet
  await db.execute(sql`update users set status = 'active', suspended_reason = null where id = ${oldEditor.id}`)
  const refused = await signIn('zz-test-old', editorPw)
  assert.equal(refused.status, 403)
  assert.match(refused.error, /365 วัน/)
  assert.equal(await status(oldEditor.id), 'suspended')

  // 8. signing in is logged and stamps the last sign-in time
  const session = await signIn('zz-test-extras', adminPw)
  assert.equal(session.status, 200)
  assert.equal(await logged('sign_in', 'zz-test-extras'), 1)
  assert.ok((await payload.findByID({ collection: 'users', id: admin.id, depth: 0 })).lastLoginAt)
  const auth = { Cookie: session.cookie, 'User-Agent': BROWSER }

  // 9. the log is read-only, and closed to the public
  const logs = await fetch(BASE + '/api/activity-logs?limit=5', { headers: auth })
  assert.equal(logs.status, 200)
  assert.ok((await logs.json()).docs.length > 0)
  assert.equal((await fetch(BASE + '/api/activity-logs')).status, 403)
  assert.equal((await post('/api/activity-logs', { action: 'create' }, { Cookie: session.cookie })).status, 403)

  // 10. Excel export and the backoffice screens
  assert.equal((await fetch(BASE + '/api/overview-export')).status, 401)
  const xl = await fetch(BASE + '/api/overview-export', { headers: auth })
  assert.equal(xl.status, 200)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await xl.arrayBuffer())
  assert.equal(wb.getWorksheet('ภาพรวม')!.rowCount, 77, '76 provinces + header')
  assert.ok(wb.getWorksheet('รายปีงบประมาณ')!.columnCount >= 3)
  for (const [p, text] of [['/admin/visit-stats', 'รายจังหวัด'], [`/admin/visit-stats?province=${loei.id}&days=90`, 'ดูทุกจังหวัด'], ['/admin/review', 'รายการรอตรวจ'], [`/admin/review?province=${loei.id}`, 'เปิดรายการเพื่อแก้ไข']] as const) {
    const r = await fetch(BASE + p, { headers: auth })
    assert.equal(r.status, 200, p)
    assert.ok((await r.text()).includes(text), `${p} shows "${text}"`)
  }

  // 11. an animated GIF is stored exactly as uploaded
  const gifPath = path.resolve(process.cwd(), '../migration/files/skhothai/file01_20230324122448.gif')
  const gif = fs.readFileSync(gifPath)
  const up = await payload.create({ collection: 'files', data: {}, file: { data: gif, mimetype: 'image/gif', name: 'zz-test-anim.gif', size: gif.length }, user: admin })
  made.files.push(up.id)
  const stored = fs.readFileSync(path.join(storageDir, up.filename!))
  assert.equal(crypto.createHash('sha256').update(stored).digest('hex'), crypto.createHash('sha256').update(gif).digest('hex'), 'GIF bytes unchanged')
  assert.equal((await payload.findByID({ collection: 'files', id: up.id, depth: 0 })).filesize, gif.length)
  assert.equal(await logged('upload', 'zz-test-anim.gif'), 1)

  // 12. topics: admins add one without a slug, a topic in use cannot be deleted, merging moves its items
  const tA = await payload.create({ collection: 'topics', data: { nameTh: 'ZZ-TEST ประเด็น ก', color: 'pink' } as never, user: admin })
  const tB = await payload.create({ collection: 'topics', data: { nameTh: 'ZZ-TEST ประเด็น ข' } as never, user: admin })
  assert.match(String(tA.slug), /^topic-/, 'a slug is made for a new topic')
  const dashA = await payload.create({
    collection: 'dashboards',
    draft: true,
    data: { province: loei.id, fiscalYear: 2569, title: 'ZZ-TEST แดชบอร์ด', topic: tA.id, provider: 'powerbi' } as never,
    user: admin,
  })
  const usageA = await (await fetch(BASE + `/api/topics/${tA.id}/usage`, { headers: auth })).json()
  assert.deepEqual(usageA, { documents: 0, dashboards: 1, trashed: 0 })
  await assert.rejects(payload.delete({ collection: 'topics', id: tA.id }), /ลบไม่ได้/)
  // only central admins may merge; the dashboard moves to B and A disappears
  assert.equal((await post(`/api/topics/${tA.id}/merge`, { into: tB.id })).status, 403, 'anonymous merge refused')
  const merged = await post(`/api/topics/${tA.id}/merge`, { into: tB.id }, { Cookie: session.cookie })
  assert.equal(merged.status, 200, await merged.text())
  assert.equal(((await payload.findByID({ collection: 'dashboards', id: dashA.id, depth: 0, draft: true })).topic as number), tB.id)
  assert.equal((await payload.find({ collection: 'topics', where: { id: { equals: tA.id } } })).totalDocs, 0)
  assert.ok((await logged('update', `รวม "ZZ-TEST ประเด็น ก" เข้ากับ "ZZ-TEST ประเด็น ข" (เอกสาร 0, แดชบอร์ด 1)`)) === 1)
  // the report lists a dashboard without a topic
  await payload.update({ collection: 'dashboards', id: dashA.id, data: { topic: null } as never, user: admin })
  const report = await fetch(BASE + '/admin/topic-report', { headers: auth })
  assert.equal(report.status, 200)
  const reportHtml = await report.text()
  assert.ok(reportHtml.includes('ZZ-TEST แดชบอร์ด'), 'unassigned dashboard listed')
  assert.ok(reportHtml.includes('ZZ-TEST ประเด็น ข'), 'topics listed')
  // an unused topic deletes normally
  await payload.delete({ collection: 'dashboards', id: dashA.id, trash: true })
  await payload.delete({ collection: 'topics', id: tB.id })
  await db.execute(sql`delete from activity_logs where subject like 'ZZ-TEST%' or subject like 'รวม "ZZ-TEST%'`)

  // 9. trash: province staff move their own rows to the trash and restore them, but cannot delete permanently
  const other = (await payload.find({ collection: 'provinces', where: { slug: { equals: 'sisaket' } }, limit: 1, depth: 0 })).docs[0]
  const editorDoc = await payload.create({ collection: 'users', data: { username: 'zz-test-trash', name: 'ทดสอบถังขยะ', role: 'province_editor', provinces: [loei.id], password: adminPw, status: 'active' } as never, context: { internal: true } })
  const editor = { ...editorDoc, collection: 'users' } as never
  const mkDash = (province: number) =>
    payload.create({ collection: 'dashboards', data: { title: 'ZZ-TEST ถังขยะ', province, fiscalYear: 2569, provider: 'powerbi', embedUrl: 'https://example.com/x', _status: 'draft' } as never, draft: true, depth: 0 })
  const own = await mkDash(loei.id)
  const foreign = await mkDash(other.id)
  const as = { user: editor, overrideAccess: false, depth: 0 } as const
  await payload.update({ collection: 'dashboards', id: own.id, data: { deletedAt: new Date().toISOString() } as never, ...as })
  assert.ok((await payload.findByID({ collection: 'dashboards', id: own.id, trash: true, depth: 0, draft: true })).deletedAt, 'editor moved own dashboard to the trash')
  await assert.rejects(payload.update({ collection: 'dashboards', id: foreign.id, data: { deletedAt: new Date().toISOString() } as never, ...as }), 'editor cannot trash another province')
  await assert.rejects(payload.delete({ collection: 'dashboards', id: own.id, trash: true, ...as }), 'editor cannot delete permanently')
  await assert.rejects(payload.delete({ collection: 'dashboards', id: foreign.id, ...as }), 'editor cannot delete permanently without the trash')
  await payload.update({ collection: 'dashboards', id: own.id, data: { deletedAt: null } as never, trash: true, ...as })
  assert.ok(!(await payload.findByID({ collection: 'dashboards', id: own.id, depth: 0, draft: true })).deletedAt, 'editor restored it')
  await payload.update({ collection: 'dashboards', id: own.id, data: { deletedAt: new Date().toISOString() } as never, ...as })
  const trashPage = await fetch(BASE + '/admin/trash?kind=dashboards', { headers: auth })
  assert.equal(trashPage.status, 200)
  assert.ok((await trashPage.text()).includes('ZZ-TEST ถังขยะ'), 'trash screen lists the trashed dashboard')
  await payload.delete({ collection: 'dashboards', id: own.id, trash: true, user: admin, overrideAccess: false })
  assert.equal((await payload.find({ collection: 'dashboards', where: { id: { equals: own.id } }, trash: true, depth: 0 })).totalDocs, 0, 'admin deleted permanently')
  await payload.delete({ collection: 'dashboards', id: foreign.id, trash: true })
  await db.execute(sql`delete from activity_logs where subject like 'ZZ-TEST%'`)

  console.log('ALL CHECKS PASSED')
} finally {
  await cleanup()
}
process.exit(0)
