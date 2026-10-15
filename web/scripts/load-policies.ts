/**
 * Puts the policy drafts from docs/policy/ into Site settings (privacy policy and cookie policy).
 * Overwrites whatever text is there; the policy version number is left alone.
 *
 *   npx payload run scripts/load-policies.ts
 */
import config from '@payload-config'
import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'

const payload = await getPayload({ config })
const read = (name: string) => fs.readFileSync(path.resolve(process.cwd(), '../docs/policy', name), 'utf8').replace(/\r\n/g, '\n').trim()

const privacyPolicy = read('privacy-policy-draft.txt')
const cookiePolicy = read('cookie-policy-draft.txt')
await payload.updateGlobal({ slug: 'site-settings', data: { privacyPolicy, cookiePolicy } })
console.log(`loaded: privacy ${privacyPolicy.length} chars, cookies ${cookiePolicy.length} chars`)
process.exit(0)
