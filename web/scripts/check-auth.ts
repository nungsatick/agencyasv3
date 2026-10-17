/**
 * End-to-end check of the account system over HTTP against the running dev server
 * (http://localhost:3000). Creates accounts named "zz-test-*" and removes them afterwards.
 *
 *   npx payload run scripts/check-auth.ts
 */
import config from '@payload-config'
import assert from 'assert'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import ExcelJS from 'exceljs'
import { getPayload } from 'payload'

import { randomPassword, totpAt } from '../src/lib/auth'

const BASE = process.env.CHECK_BASE_URL ?? 'http://localhost:3000'
const payload = await getPayload({ config })

type Res = { status: number; body: any; cookie?: string }
async function call(method: string, path: string, body?: unknown, cookie?: string): Promise<Res> {
  const headers: Record<string, string> = { Origin: BASE }
  if (cookie) headers.Cookie = cookie
  let payloadBody: BodyInit | undefined
  if (body instanceof FormData) payloadBody = body
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payloadBody = JSON.stringify(body)
  }
  const res = await fetch(BASE + path, { method, headers, body: payloadBody })
  const setCookie = res.headers.get('set-cookie')
  return { status: res.status, body: await res.json().catch(() => ({})), cookie: setCookie ? setCookie.split(';')[0] : undefined }
}

/** Password step + code step. Returns the session cookie, and the secret/recovery codes when 2FA was set up. */
async function signIn(username: string, password: string, secret?: string) {
  const one = await call('POST', '/api/users/sign-in', { username, password })
  assert.equal(one.status, 200, `sign-in ${username}: ${JSON.stringify(one.body)}`)
  const useSecret = one.body.next === 'setup' ? one.body.secret : secret
  const two = await call('POST', '/api/users/sign-in/code', { ticket: one.body.ticket, code: totpAt(useSecret) })
  assert.equal(two.status, 200, `code ${username}: ${JSON.stringify(two.body)}`)
  assert(two.cookie, 'session cookie set')
  return { next: one.body.next as string, cookie: two.cookie!, secret: useSecret as string, recoveryCodes: two.body.recoveryCodes as string[] | undefined }
}

const testFileIds: number[] = []

const cleanup = async () => {
  for (const id of testFileIds.splice(0).reverse()) await payload.delete({ collection: 'files', id }).catch(() => undefined)
  const users = await payload.find({ collection: 'users', where: { username: { like: 'zz-test-' } }, limit: 100, depth: 0 })
  for (const u of users.docs) {
    const tokens = await payload.find({ collection: 'user-tokens', where: { user: { equals: u.id } }, limit: 100, depth: 0 })
    for (const t of tokens.docs) await payload.delete({ collection: 'user-tokens', id: t.id })
    await payload.delete({ collection: 'users', id: u.id })
  }
}

try {
  await cleanup()
  const provinces = (await payload.find({ collection: 'provinces', limit: 2, sort: 'id' })).docs
  const [provA, provB] = provinces

  // A throwaway central admin to drive the admin-side endpoints.
  const adminPw = randomPassword()
  await payload.create({
    collection: 'users',
    data: { username: 'zz-test-admin', name: 'ทดสอบ ส่วนกลาง', role: 'admin', password: adminPw, status: 'active' } as any,
    context: { internal: true },
  })

  // 1. Payload's own password login is closed, even with the right password.
  const native = await call('POST', '/api/users/login', { username: 'zz-test-admin', password: adminPw })
  assert.equal(native.status, 403, 'native login must be blocked')
  assert.equal(native.cookie, undefined)

  // 2. First sign-in forces 2FA setup and hands out recovery codes once.
  const admin = await signIn('zz-test-admin', adminPw)
  assert.equal(admin.next, 'setup')
  assert.equal(admin.recoveryCodes?.length, 10)
  const me = await call('GET', '/api/users/me', undefined, admin.cookie)
  assert.equal(me.body.user?.username, 'zz-test-admin')
  assert.equal(me.body.user.totpSecret, undefined, 'secret never leaves the server')
  assert.equal(me.body.user.recoveryCodes, undefined)

  // 3. Second sign-in asks for a code; a wrong code is refused with a countdown.
  const again = await call('POST', '/api/users/sign-in', { username: 'zz-test-admin', password: adminPw })
  assert.equal(again.body.next, 'code')
  const wrong = await call('POST', '/api/users/sign-in/code', { ticket: again.body.ticket, code: '000000' })
  assert.equal(wrong.status, 401)
  assert.match(wrong.body.error, /อีก 4 ครั้ง/)
  const rec = await call('POST', '/api/users/sign-in/code', { ticket: again.body.ticket, code: admin.recoveryCodes![0] })
  assert.equal(rec.status, 200, 'recovery code works')
  const again2 = await call('POST', '/api/users/sign-in', { username: 'zz-test-admin', password: adminPw })
  const reuse = await call('POST', '/api/users/sign-in/code', { ticket: again2.body.ticket, code: admin.recoveryCodes![0] })
  assert.equal(reuse.status, 401, 'a recovery code works only once')

  // 4. Invite a province manager; the one-time link sets the password and leads into 2FA setup.
  const inv = await call('POST', '/api/users/invite', { username: 'zz-test-manager', name: 'ทดสอบ ผู้ดูแลจังหวัด', role: 'province_manager', provinces: [provA.id], email: '' }, admin.cookie)
  assert.equal(inv.status, 200, JSON.stringify(inv.body))
  const token = inv.body.url.split('/activate/')[1]
  assert.equal((await call('POST', '/api/users/sign-in', { username: 'zz-test-manager', password: 'whatever-123' })).status, 401, 'invited account cannot sign in')
  const info = await call('GET', `/api/users/link/${token}`)
  assert.equal(info.body.username, 'zz-test-manager')
  assert.equal((await call('POST', `/api/users/link/${token}`, { password: 'short' })).status, 400)
  // the minimum is 8 characters: 7 is refused
  assert.equal((await call('POST', `/api/users/link/${token}`, { password: 'Qz7#mPw' })).status, 400)
  const managerPw = 'manager-password-2569'
  const act = await call('POST', `/api/users/link/${token}`, { password: managerPw })
  assert.equal(act.body.next, 'setup', JSON.stringify(act.body))
  const actDone = await call('POST', '/api/users/sign-in/code', { ticket: act.body.ticket, code: totpAt(act.body.secret) })
  assert.equal(actDone.status, 200)
  const manager = { cookie: actDone.cookie!, secret: act.body.secret as string }
  assert.equal((await call('GET', `/api/users/link/${token}`)).status, 404, 'link is single-use')

  // 5. A manager can add staff, but only editors of their own province.
  const inv2 = await call('POST', '/api/users/invite', { username: 'zz-test-editor', name: 'ทดสอบ เจ้าหน้าที่', role: 'admin', provinces: [provB.id] }, manager.cookie)
  assert.equal(inv2.status, 200, JSON.stringify(inv2.body))
  const editorRow = (await payload.find({ collection: 'users', where: { username: { equals: 'zz-test-editor' } }, depth: 0 })).docs[0]
  assert.equal(editorRow.role, 'province_editor', 'role forced to editor')
  assert.deepEqual(editorRow.provinces, [provA.id], 'province forced to the manager’s own')
  const editorPw = 'editor-password-2569'
  const eAct = await call('POST', `/api/users/link/${inv2.body.url.split('/activate/')[1]}`, { password: editorPw })
  const eDone = await call('POST', '/api/users/sign-in/code', { ticket: eAct.body.ticket, code: totpAt(eAct.body.secret) })
  const editor = { cookie: eDone.cookie!, secret: eAct.body.secret as string }

  // 6. Visibility and permissions.
  const mgrList = await call('GET', '/api/users?limit=100', undefined, manager.cookie)
  assert.deepEqual(mgrList.body.docs.map((u: any) => u.username).sort(), ['zz-test-editor', 'zz-test-manager'])
  const edList = await call('GET', '/api/users?limit=100', undefined, editor.cookie)
  assert.deepEqual(edList.body.docs.map((u: any) => u.username), ['zz-test-editor'])
  assert.equal((await call('POST', '/api/users/invite', { username: 'zz-test-x', name: 'x', role: 'province_editor' }, editor.cookie)).status, 403)
  const adminRow = (await payload.find({ collection: 'users', where: { username: { equals: 'zz-test-admin' } }, depth: 0 })).docs[0]
  assert.equal((await call('POST', `/api/users/${adminRow.id}/link`, {}, manager.cookie)).status, 403, 'manager cannot touch an admin')
  assert.equal((await call('POST', `/api/users/${editorRow.id}/reset-2fa`, {}, editor.cookie)).status, 403, 'editor cannot manage accounts')

  // 7. Editors only change their own province's content.
  const docOther = (await payload.find({ collection: 'documents', where: { province: { equals: provB.id } }, limit: 1, depth: 0 })).docs[0]
  const docOwn = (await payload.find({ collection: 'documents', where: { province: { equals: provA.id } }, limit: 1, depth: 0 })).docs[0]
  assert.equal((await call('PATCH', `/api/documents/${docOther.id}`, { description: 'x' }, editor.cookie)).status, 403)
  const own = await call('PATCH', `/api/documents/${docOwn.id}`, { description: docOwn.description ?? null }, editor.cookie)
  assert.equal(own.status, 200, JSON.stringify(own.body).slice(0, 300))
  // …and cannot move a row into another province, nor add one there
  assert.equal((await call('PATCH', `/api/documents/${docOwn.id}`, { province: provB.id }, editor.cookie)).status, 403, 'move to another province refused')
  assert.equal(Number((await payload.findByID({ collection: 'documents', id: docOwn.id, depth: 0 })).province), provA.id, 'row stayed in its province')
  const draft = { title: 'zz-test ร่างทดสอบจังหวัด', fiscalYear: docOwn.fiscalYear, type: docOwn.type, _status: 'draft' }
  assert.equal((await call('POST', '/api/documents?draft=true', { ...draft, province: provB.id }, editor.cookie)).status, 403, 'create in another province refused')
  // no province given: the editor's own
  const ownDraft = await call('POST', '/api/documents?draft=true', draft, editor.cookie)
  assert.equal(ownDraft.status, 201, JSON.stringify(ownDraft.body).slice(0, 300))
  assert.equal(Number(ownDraft.body.doc.province?.id ?? ownDraft.body.doc.province), provA.id, 'new row starts in the editor’s province')
  await payload.delete({ collection: 'documents', id: ownDraft.body.doc.id, overrideAccess: true, trash: false } as never)
  assert.equal((await payload.find({ collection: 'documents', where: { title: { like: 'zz-test' } }, trash: true, limit: 5, depth: 0 } as never)).totalDocs, 0, 'test rows removed')

  // 8. Reset 2FA → next sign-in goes through setup again.
  assert.equal((await call('POST', `/api/users/${editorRow.id}/reset-2fa`, {}, manager.cookie)).status, 200)
  const afterReset = await signIn('zz-test-editor', editorPw)
  assert.equal(afterReset.next, 'setup')

  // 9. A manager issues a new-password link; the old password stops working.
  const reset = await call('POST', `/api/users/${editorRow.id}/link`, {}, manager.cookie)
  assert.equal(reset.body.purpose, 'password_reset')
  const newPw = 'editor-new-password-2569'
  const rDone = await call('POST', `/api/users/link/${reset.body.url.split('/activate/')[1]}`, { password: newPw })
  assert.equal(rDone.body.next, 'code')
  assert.equal((await call('POST', '/api/users/sign-in', { username: 'zz-test-editor', password: editorPw })).status, 401)

  // 10. Suspend: sign-in refused and the existing session dies.
  assert.equal((await call('POST', `/api/users/${editorRow.id}/suspend`, { suspended: true, reason: 'ย้ายหน่วยงาน' }, admin.cookie)).status, 200)
  assert.equal((await call('POST', '/api/users/sign-in', { username: 'zz-test-editor', password: newPw })).status, 403)
  assert.equal((await call('GET', '/api/users/me', undefined, afterReset.cookie)).body.user, null, 'session ended on suspend')
  assert.equal((await call('POST', `/api/users/${editorRow.id}/suspend`, { suspended: false }, admin.cookie)).body.status, 'active')

  // 11. An account created through the generic API never keeps the typed password.
  const typed = await call('POST', '/api/users', { username: 'zz-test-typed', name: 'ทดสอบ', role: 'province_editor', provinces: [provA.id], password: 'typed-password-2569' }, admin.cookie)
  assert.equal(typed.status, 201, JSON.stringify(typed.body).slice(0, 300))
  assert.equal(typed.body.doc.status, 'invited')
  assert.equal((await call('POST', '/api/users/sign-in', { username: 'zz-test-typed', password: 'typed-password-2569' })).status, 401)

  // 11b. An admin cannot set someone else's password through the generic API either.
  const forced = await call('PATCH', `/api/users/${editorRow.id}`, { password: 'forced-by-admin-2569' }, admin.cookie)
  assert.equal(forced.status, 200)
  assert.equal((await call('POST', '/api/users/sign-in', { username: 'zz-test-editor', password: 'forced-by-admin-2569' })).status, 401)
  assert.equal((await call('POST', '/api/users/sign-in', { username: 'zz-test-editor', password: newPw })).status, 200)

  // 11c. The document form's file manager talks to the API like this: upload, replace, history, restore.
  const samples = path.resolve(process.cwd(), '..', 'migration', 'files', 'loei')
  const [pdfOne, pdfTwo] = fs.readdirSync(samples).filter((f) => f.endsWith('.pdf')).slice(0, 2).map((f) => fs.readFileSync(path.join(samples, f)))
  const sha = (b: Buffer | ArrayBuffer) => crypto.createHash('sha256').update(Buffer.from(b as ArrayBuffer)).digest('hex')
  const upload = (buf: Buffer, name: string, note?: string) => {
    const f = new FormData()
    f.set('file', new File([buf], name, { type: 'application/pdf' }))
    f.set('_payload', JSON.stringify(note ? { changeNote: note } : {}))
    return f
  }
  const made = await call('POST', '/api/files', upload(pdfOne, 'zz-test-file.pdf'), admin.cookie)
  assert.equal(made.status, 201, JSON.stringify(made.body).slice(0, 300))
  const fileId = made.body.doc.id as number
  testFileIds.push(fileId)
  const publicPath = made.body.doc.publicPath as string
  const replaced = await call('PATCH', `/api/files/${fileId}`, upload(pdfTwo, 'zz-test-file-v2.pdf', 'แก้คำผิด'), admin.cookie)
  assert.equal(replaced.status, 200, JSON.stringify(replaced.body).slice(0, 300))
  assert.equal(replaced.body.doc.versionNo, 2)
  assert.equal(replaced.body.doc.publicPath, publicPath)
  const hist = await call('GET', `/api/files?where[versionOf][equals]=${fileId}&depth=0`, undefined, admin.cookie)
  assert.equal(hist.body.totalDocs, 1)
  testFileIds.push(hist.body.docs[0].id)
  assert.equal((await call('GET', `/api/files?where[versionOf][equals]=${fileId}`)).body.totalDocs, 0, 'visitors cannot list old versions')
  const servedTwo = await fetch(`${BASE}/${publicPath.split('/').map(encodeURIComponent).join('/')}`)
  assert.equal(sha(await servedTwo.arrayBuffer()), sha(pdfTwo), 'public link serves the replacement')
  const restored = await call('POST', `/api/files/${hist.body.docs[0].id}/restore`, {}, admin.cookie)
  assert.equal(restored.body.versionNo, 3, JSON.stringify(restored.body))
  const servedOne = await fetch(`${BASE}/${publicPath.split('/').map(encodeURIComponent).join('/')}`, { cache: 'no-store' })
  assert.equal(sha(await servedOne.arrayBuffer()), sha(pdfOne), 'public link serves the restored version')
  const hist2 = await call('GET', `/api/files?where[versionOf][equals]=${fileId}&depth=0`, undefined, admin.cookie)
  testFileIds.push(...hist2.body.docs.map((d: any) => d.id))
  assert.equal(hist2.body.totalDocs, 2)
  assert.equal((await call('POST', `/api/files/${hist.body.docs[0].id}/restore`, {})).status, 401, 'restore needs sign-in')

  // 12. Excel import: preview reports problems; confirm creates only the valid rows.
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('ผู้ใช้')
  ws.addRow(['ชื่อผู้ใช้ (username) *', 'ชื่อ นามสกุล *', 'ตำแหน่ง', 'อีเมล', 'โทรศัพท์', 'บทบาท *', 'จังหวัด *'])
  ws.addRow(['zz-test-xl1', 'นำเข้า หนึ่ง', '', '', '', 'เจ้าหน้าที่จังหวัด', provA.nameTh])
  ws.addRow(['zz-test-xl2', 'นำเข้า สอง', 'นักวิชาการสถิติ', 'a@example.go.th', '0 0000 0000', 'ผู้ดูแลจังหวัด', provB.nameTh])
  ws.addRow(['zz-test-manager', 'ซ้ำ', '', '', '', 'เจ้าหน้าที่จังหวัด', provA.nameTh])
  ws.addRow(['Bad Name', '', '', '', '', 'เจ้าหน้าที่จังหวัด', ''])
  ws.addRow(['', '', '', '', '', 'ผู้ดูแลจังหวัด', provA.nameTh]) // untouched template row: ignored
  const xlsx = Buffer.from(await wb.xlsx.writeBuffer())
  const form = (confirm: boolean) => {
    const f = new FormData()
    f.set('file', new File([xlsx], 'users.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    if (confirm) f.set('confirm', '1')
    return f
  }
  const preview = await call('POST', '/api/users/import', form(false), admin.cookie)
  assert.equal(preview.status, 200, JSON.stringify(preview.body))
  assert.equal(preview.body.total, 4)
  assert.equal(preview.body.ready, 2)
  assert.deepEqual(preview.body.invalid.map((r: any) => r.row), [4, 5])
  assert.equal((await payload.find({ collection: 'users', where: { username: { like: 'zz-test-xl' } } })).totalDocs, 0, 'preview creates nothing')
  const done = await call('POST', '/api/users/import', form(true), admin.cookie)
  assert.equal(done.body.created.length, 2)
  assert.match(done.body.created[0].url, /\/activate\//)
  assert.equal((await call('POST', '/api/users/import', form(false), editor.cookie)).status, 403)

  // 12b. "My account": change own password, move 2FA to a new phone, renew recovery codes.
  const acct = await call('GET', '/api/users/account', undefined, admin.cookie)
  assert.equal(acct.body.username, 'zz-test-admin')
  assert.equal(acct.body.recoveryCodesLeft, 9, 'one recovery code was used earlier')
  assert.equal((await call('GET', '/api/users/account')).status, 401)
  assert.equal((await call('POST', '/api/users/account/password', { current: 'not-my-password', next: 'brand-new-password-1' }, admin.cookie)).status, 400)
  assert.equal((await call('POST', '/api/users/account/password', { current: adminPw, next: 'short' }, admin.cookie)).status, 400)
  const adminPw2 = 'admin-new-password-2569'
  assert.equal((await call('POST', '/api/users/account/password', { current: adminPw, next: adminPw2 }, admin.cookie)).status, 200)
  assert.equal((await call('POST', '/api/users/sign-in', { username: 'zz-test-admin', password: adminPw })).status, 401, 'old password stops working')
  assert.equal((await call('GET', '/api/users/me', undefined, admin.cookie)).body.user, null, 'changing the password signs out every session')
  admin.cookie = (await signIn('zz-test-admin', adminPw2, admin.secret)).cookie
  // the generic API cannot change a password, not even one's own
  await call('PATCH', `/api/users/${adminRow.id}`, { password: 'sneaky-password-2569' }, admin.cookie)
  assert.equal((await call('POST', '/api/users/sign-in', { username: 'zz-test-admin', password: 'sneaky-password-2569' })).status, 401)
  // move 2FA
  assert.equal((await call('POST', '/api/users/account/2fa/start', { password: 'wrong-password-x' }, admin.cookie)).status, 400)
  const move = await call('POST', '/api/users/account/2fa/start', { password: adminPw2 }, admin.cookie)
  assert.equal(move.status, 200)
  assert.equal((await call('POST', '/api/users/account/2fa/confirm', { ticket: move.body.ticket, code: '000000' }, admin.cookie)).status, 400)
  const moved = await call('POST', '/api/users/account/2fa/confirm', { ticket: move.body.ticket, code: totpAt(move.body.secret) }, admin.cookie)
  assert.equal(moved.body.recoveryCodes.length, 10)
  const step = await call('POST', '/api/users/sign-in', { username: 'zz-test-admin', password: adminPw2 })
  assert.equal(step.body.next, 'code')
  assert.equal((await call('POST', '/api/users/sign-in/code', { ticket: step.body.ticket, code: totpAt(admin.secret) })).status, 401, 'old phone no longer works')
  assert.equal((await call('POST', '/api/users/sign-in/code', { ticket: step.body.ticket, code: admin.recoveryCodes![1] })).status, 401, 'old recovery codes no longer work')
  assert.equal((await call('POST', '/api/users/sign-in/code', { ticket: step.body.ticket, code: totpAt(move.body.secret) })).status, 200)
  // renew recovery codes
  assert.equal((await call('POST', '/api/users/account/recovery-codes', { code: '000000' }, admin.cookie)).status, 400)
  const renewed = await call('POST', '/api/users/account/recovery-codes', { code: totpAt(move.body.secret) }, admin.cookie)
  assert.equal(renewed.body.recoveryCodes.length, 10)
  const step2 = await call('POST', '/api/users/sign-in', { username: 'zz-test-admin', password: adminPw2 })
  assert.equal((await call('POST', '/api/users/sign-in/code', { ticket: step2.body.ticket, code: moved.body.recoveryCodes[0] })).status, 401)
  assert.equal((await call('POST', '/api/users/sign-in/code', { ticket: step2.body.ticket, code: renewed.body.recoveryCodes[0] })).status, 200)

  // 13. Five wrong passwords lock the account.
  for (let i = 0; i < 5; i++) await call('POST', '/api/users/sign-in', { username: 'zz-test-manager', password: 'wrong-password' })
  assert.equal((await call('POST', '/api/users/sign-in', { username: 'zz-test-manager', password: managerPw })).status, 423)

  console.log('ALL CHECKS PASSED')
} finally {
  await cleanup()
}
// test runs must not leave lines in the activity log
await (payload.db as unknown as { pool: { query: (q: string) => Promise<unknown> } }).pool.query("delete from activity_logs where username like 'zz-test-%' or subject like 'zz-test%' or subject like 'ZZ-%' or subject like 'ทดสอบ เวอร์ชัน%'")
process.exit(0)
