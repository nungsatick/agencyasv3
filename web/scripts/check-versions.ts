/**
 * End-to-end check of file history, publish validation and trash against the dev database.
 * Creates its own rows and removes them afterwards.
 *
 *   npx payload run scripts/check-versions.ts
 */
import config from '@payload-config'
import assert from 'assert'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { createLocalReq, getPayload } from 'payload'

import { restoreVersion } from '../src/hooks/files'

const storage = path.resolve(process.cwd(), 'storage')
// Two real PDFs from the legacy download serve as "version one" and "version two".
const samples = path.resolve(process.cwd(), '..', 'migration', 'files', 'loei')
const [fileOne, fileTwo] = fs
  .readdirSync(samples)
  .filter((f) => f.endsWith('.pdf'))
  .slice(0, 2)
  .map((f) => fs.readFileSync(path.join(samples, f)))
const sha = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex')
const upload = (data: Buffer, name = 'ทดสอบ เวอร์ชัน.pdf') => ({ data, mimetype: 'application/pdf', name, size: data.length })
const onDisk = (name: string) => sha(fs.readFileSync(path.join(storage, name)))

const payload = await getPayload({ config })
const created: number[] = []
let docId: number | undefined
try {
  const admin = (await payload.find({ collection: 'users', where: { role: { equals: 'admin' } }, limit: 1 })).docs[0]
  assert(admin, 'needs one admin user')

  // 1. first upload
  const v1 = await payload.create({ collection: 'files', data: {}, file: upload(fileOne), user: admin })
  created.push(v1.id)
  assert.equal(v1.versionNo, 1)
  assert.equal(v1.isCurrent, true)
  assert.match(v1.publicPath!, /^uploads\/f\/[0-9a-f]{10}\//)
  assert.equal(v1.sha256, sha(fileOne))

  // 2. replace it
  const v2 = await payload.update({ collection: 'files', id: v1.id, data: { changeNote: 'แก้คำผิด' }, file: upload(fileTwo), user: admin })
  assert.equal(v2.id, v1.id, 'same row, so relations stay valid')
  assert.equal(v2.versionNo, 2)
  assert.equal(v2.publicPath, v1.publicPath, 'public path is stable')
  assert.notEqual(v2.sha256, v1.sha256)
  assert.equal(onDisk(v2.filename!), sha(fileTwo))
  let history = (await payload.find({ collection: 'files', where: { versionOf: { equals: v1.id } }, sort: 'versionNo' })).docs
  created.push(...history.map((h) => h.id))
  assert.equal(history.length, 1)
  assert.equal(history[0].versionNo, 1)
  assert.equal(history[0].isCurrent, false)
  assert.equal(history[0].sha256, v1.sha256)
  assert.equal(onDisk(history[0].filename!), sha(fileOne))

  // 3. anonymous visitors cannot read superseded versions
  const anon = await payload.find({ collection: 'files', where: { versionOf: { equals: v1.id } }, overrideAccess: false })
  assert.equal(anon.totalDocs, 0)

  // 4. restore version 1 → becomes version 3, version 2 is archived
  const req = await createLocalReq({ user: admin }, payload)
  req.routeParams = { id: String(history[0].id) }
  const res = await restoreVersion(req)
  assert.equal(res.status, 200)
  const v3 = await payload.findByID({ collection: 'files', id: v1.id })
  assert.equal(v3.versionNo, 3)
  assert.equal(v3.sha256, v1.sha256)
  assert.equal(onDisk(v3.filename!), sha(fileOne))
  history = (await payload.find({ collection: 'files', where: { versionOf: { equals: v1.id } }, sort: 'versionNo' })).docs
  created.push(...history.map((h) => h.id))
  assert.deepEqual(history.map((h) => h.versionNo), [1, 2])

  // 5. publishing needs a file
  const province = (await payload.find({ collection: 'provinces', limit: 1 })).docs[0]
  const type = (await payload.find({ collection: 'document-types', limit: 1 })).docs[0]
  const base = { province: province.id, fiscalYear: 2569, type: type.id, title: 'ทดสอบระบบ (ลบได้)' }
  await assert.rejects(
    payload.create({ collection: 'documents', data: { ...base, _status: 'published' } }),
    /แนบไฟล์/,
  )
  const doc = await payload.create({ collection: 'documents', data: { ...base, files: [v1.id], _status: 'published' } })
  docId = doc.id

  // 6. trash hides the document, and it can be brought back
  await payload.update({ collection: 'documents', id: doc.id, data: { deletedAt: new Date().toISOString() } })
  const visible = await payload.find({ collection: 'documents', where: { id: { equals: doc.id } } })
  assert.equal(visible.totalDocs, 0, 'trashed documents are hidden')
  const inTrash = await payload.find({ collection: 'documents', where: { id: { equals: doc.id } }, trash: true })
  assert.equal(inTrash.totalDocs, 1)
  await payload.update({ collection: 'documents', id: doc.id, data: { deletedAt: null }, trash: true })
  assert.equal((await payload.find({ collection: 'documents', where: { id: { equals: doc.id } } })).totalDocs, 1)

  console.log('ALL CHECKS PASSED')
} finally {
  if (docId) await payload.delete({ collection: 'documents', id: docId, trash: true }).catch((e) => console.error('cleanup doc', e.message))
  for (const id of [...new Set(created)].reverse())
    await payload.delete({ collection: 'files', id }).catch((e) => console.error('cleanup file', id, e.message))
}
// test runs must not leave lines in the activity log
await (payload.db as unknown as { pool: { query: (q: string) => Promise<unknown> } }).pool.query("delete from activity_logs where username like 'zz-test-%' or subject like 'zz-test%' or subject like 'ZZ-%' or subject like 'ทดสอบ เวอร์ชัน%'")
process.exit(0)
