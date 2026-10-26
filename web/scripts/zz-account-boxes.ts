// Temporary check of the 6-box codes on /admin/account (deleted after use). Creates and removes "zz-test-account".
import config from '@payload-config'
import assert from 'assert'
import { getPayload } from 'payload'
import { chromium } from 'playwright-core'

import { randomPassword, totpAt } from '../src/lib/auth'

const BASE = 'http://localhost:3000'
const OUT = process.env.SHOT_DIR ?? '.'
const USER = 'zz-test-account'
const wait30 = () => new Promise((r) => setTimeout(r, 31_000 - (Date.now() % 30_000)))

const payload = await getPayload({ config })
const drop = async () => {
  for (const u of (await payload.find({ collection: 'users', where: { username: { equals: USER } }, limit: 1, depth: 0 })).docs)
    await payload.delete({ collection: 'users', id: u.id, context: { internal: true } })
}
await drop()
const pw = randomPassword()
await payload.create({ collection: 'users', data: { username: USER, name: 'ทดสอบ บัญชีของฉัน', role: 'admin', password: pw, status: 'active' } as any, context: { internal: true } })

const post = async (path: string, body: unknown) => {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' }, body: JSON.stringify(body) })
  return { body: (await r.json()) as any, cookie: r.headers.get('set-cookie') }
}
const one = await post('/api/users/sign-in', { username: USER, password: pw })
let secret = one.body.secret as string
const two = await post('/api/users/sign-in/code', { ticket: one.body.ticket, code: totpAt(secret) })
const token = /payload-token=([^;]+)/.exec(two.cookie ?? '')![1]

const browser = await chromium.launch({ channel: 'chrome' })
try {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } })
  await ctx.addCookies([{ name: 'payload-token', value: token, domain: 'localhost', path: '/' }])
  const page = await ctx.newPage()
  await page.goto(BASE + '/admin/my-account')
  await page.waitForSelector('.code-boxes__box')
  // opening the page does not jump into the recovery-code boxes
  assert.notEqual(await page.evaluate(() => document.activeElement?.className ?? ''), 'code-boxes__box')
  await page.screenshot({ path: `${OUT}/account-boxes.png`, fullPage: true })
  console.log('page opens without grabbing focus; recovery card shows 6 boxes')

  // recovery codes: six digits alone do not send; the button does
  const renew = page.locator('form.agy__card').last()
  let renewCalls = 0
  page.on('request', (r) => r.url().includes('/recovery-codes') && renewCalls++)
  await wait30()
  await renew.locator('.code-boxes__box').first().click()
  await page.keyboard.type(totpAt(secret), { delay: 40 })
  await page.waitForTimeout(1000)
  assert.equal(renewCalls, 0, 'renew must wait for the button')
  await renew.locator('button').click()
  await page.waitForSelector('text=เก็บรหัสสำรองไว้', { timeout: 10_000 }).catch(() => page.waitForSelector('.agy-codes, code'))
  assert.equal(renewCalls, 1)
  console.log('recovery codes: not sent on the sixth digit, sent by the button')
  await page.goto(BASE + '/admin/my-account')

  // move 2FA: the sixth digit confirms by itself; a wrong code empties the boxes
  await page.fill('input[autocomplete="current-password"] >> nth=1', pw)
  await page.click('text=เริ่มตั้งค่าบนเครื่องใหม่')
  await page.waitForSelector('.agy-setup .code-boxes__box')
  const next = (await page.textContent('.agy-setup code'))!.replace(/\s/g, '')
  await page.screenshot({ path: `${OUT}/account-move.png` })
  await page.keyboard.type('000000', { delay: 40 })
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLInputElement>('.agy-setup .code-boxes__box')].every((b) => b.value === '' && !b.disabled))
  console.log('move 2FA: wrong code sent on the sixth digit, boxes emptied')
  await wait30()
  await page.locator('.agy-setup .code-boxes__box').first().click()
  await page.keyboard.type(totpAt(next), { delay: 40 })
  await page.waitForSelector('text=ตั้งค่า 2FA ใหม่แล้ว', { timeout: 15_000 })
  secret = next
  console.log('move 2FA: right code confirmed without the button')
  await ctx.close()
} finally {
  await browser.close()
  await drop()
  console.log('removed', USER)
}
process.exit(0)
