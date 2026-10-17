import config from '@payload-config'
import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'
import { Readable } from 'stream'

import { storageDir } from '@/collections/Content'
import { countHit, uncounted } from '@/lib/site'

// Serves files at their stable public path, e.g. /uploads/content/smprakan/file01_20220527040401.pdf
// (the same URL the old site used). The path always resolves to the current version of the file.
export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params
  const publicPath = ['uploads', ...parts].join('/')
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: 'files',
    where: { and: [{ publicPath: { equals: publicPath } }, { isCurrent: { equals: true } }] },
    limit: 1,
    depth: 0,
  })
  const file = res.docs[0]
  if (!file?.filename) return new Response('Not found', { status: 404 })

  const onDisk = path.join(storageDir, file.filename)
  let stat: fs.Stats
  try {
    stat = await fs.promises.stat(onDisk)
  } catch {
    return new Response('Not found', { status: 404 })
  }
  // Count a download / direct open. "?view=1" is the in-page preview: the page counts that itself when the
  // preview opens (POST /hit), because the browser may serve the file again from its cache and a PDF viewer
  // can fetch it twice. A viewer fetching the rest of a file in ranges is the same open: only the first counts.
  const range = req.headers.get('range')
  const query = new URL(req.url).searchParams
  if (!query.has('cover') && !query.has('view') && (!range || /^bytes=0-/.test(range)) && !uncounted(req.headers.get('user-agent'), req.headers.get('cookie'))) {
    await countHit('file_download', file.id).catch(() => undefined)
  }

  const body = Readable.toWeb(fs.createReadStream(onDisk)) as ReadableStream
  return new Response(body, {
    headers: {
      'Content-Type': file.mimeType ?? 'application/octet-stream',
      'Content-Length': String(stat.size),
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.originalName ?? file.filename)}`,
      'Cache-Control': 'public, max-age=300',
    },
  })
}
