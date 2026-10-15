/**
 * Puts the provinces' header pictures from a folder onto their sites. Files are named by province code
 * ({CODE}.jpg, e.g. SSK.jpg = ศรีสะเกษ; .jpeg / .png / .webp also accepted); see 76province_hero/province_images_76.xlsx.
 * A province that already has a picture gets the folder's one instead (the old file stays in "ไฟล์").
 * Files whose name matches no province are listed and skipped. Run again whenever more pictures arrive:
 * a picture already in place (same content) is not uploaded twice.
 *
 *   npx payload run scripts/load-hero-images.ts      (DRY=1 only lists)
 */
import config from '@payload-config'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'

import { logActivity } from '../src/lib/activity'

const dir = path.resolve(process.env.HERO_DIR ?? '../76province_hero')
const dry = process.env.DRY === '1'
const payload = await getPayload({ config })

const provinces = (await payload.find({ collection: 'provinces', limit: 200, depth: 1, pagination: false })).docs
const byCode = new Map(provinces.map((p) => [p.code.toUpperCase(), p]))
const files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !f.startsWith('~$'))

let done = 0
const skipped: string[] = []
for (const name of files) {
  const code = path.parse(name).name.toUpperCase()
  const p = byCode.get(code)
  if (!p) {
    skipped.push(`${name}: ไม่ตรงกับรหัสจังหวัดใด`)
    continue
  }
  const full = path.join(dir, name)
  const sha = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')
  const current = typeof p.heroImage === 'object' ? p.heroImage : null
  if (current && (current as { sha256?: string | null }).sha256 === sha) {
    skipped.push(`${name}: ${p.nameTh} ใช้ภาพนี้อยู่แล้ว`)
    continue
  }
  const kb = Math.round(fs.statSync(full).size / 1024)
  console.log(`${dry ? '[dry] ' : ''}${name} → ${p.nameTh}${current ? ' (แทนภาพเดิม)' : ''} · ${kb} KB${kb > 500 ? ' (เกิน 500 KB ที่แนะนำ)' : ''}`)
  if (dry) continue
  const file = await payload.create({ collection: 'files', data: { originalName: name } as never, filePath: full })
  await payload.update({ collection: 'provinces', id: p.id, data: { heroImage: file.id } as never })
  await logActivity(payload, { action: 'update', area: 'จังหวัด', subject: `ภาพเด่นส่วนหัว ${p.nameTh} (${name})`, province: p.id })
  done++
}
console.log(`${dry ? 'would set' : 'set'} ${dry ? files.length - skipped.length : done} pictures; skipped ${skipped.length}; provinces still without a picture: ${provinces.filter((p) => !p.heroImage).length - (dry ? 0 : 0)}`)
for (const s of skipped) console.log('  skipped', s)
process.exit(0)
