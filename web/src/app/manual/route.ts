import config from '@payload-config'
import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'
import { Readable } from 'stream'

// The user manuals hold screenshots of the backoffice, so only signed-in staff get them:
// central admins the admin manual, province managers and province staff the province manual.
// Replace a manual by copying a new PDF over web/manuals/<name>.pdf.
const MANUALS = {
  admin: { file: 'admin.pdf', title: 'คู่มือผู้ดูแลระบบ.pdf' },
  province: { file: 'province.pdf', title: 'คู่มือผู้ดูแลจังหวัด.pdf' },
}

export async function GET(req: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) return Response.redirect(new URL('/login', req.url), 303)

  const manual = (user as { role?: string }).role === 'admin' ? MANUALS.admin : MANUALS.province
  const onDisk = path.join(process.cwd(), 'manuals', manual.file)
  let stat: fs.Stats
  try {
    stat = await fs.promises.stat(onDisk)
  } catch {
    return new Response('ยังไม่มีไฟล์คู่มือ', { status: 404 })
  }
  return new Response(Readable.toWeb(fs.createReadStream(onDisk)) as ReadableStream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(stat.size),
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(manual.title)}`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}
