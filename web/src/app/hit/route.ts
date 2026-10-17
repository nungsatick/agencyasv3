import config from '@payload-config'
import { getPayload } from 'payload'

import { countHit, uncounted } from '@/lib/site'

// POST /hit { kind: 'doc_link' | 'dashboard_view' | 'file_view' | 'guide_link', id } — a visitor opened a document's
// external link, a dashboard, a file's in-page preview (id = the file), or a link in a guides-page topic (id = the topic). Only published items and current
// files are counted; nothing about the visitor is stored. Previews are counted here, when one is opened,
// rather than on the file request, which the browser may answer from its cache.
export async function POST(req: Request) {
  const { kind, id } = (await req.json().catch(() => ({}))) as { kind?: string; id?: number }
  const collection = kind === 'doc_link' ? 'documents' : kind === 'dashboard_view' ? 'dashboards' : kind === 'file_view' ? 'files' : kind === 'guide_link' ? 'central-contents' : null
  if (!collection || !Number.isInteger(id)) return new Response(null, { status: 400 })
  if (uncounted(req.headers.get('user-agent'), req.headers.get('cookie'))) return new Response(null, { status: 204 })
  const payload = await getPayload({ config })
  // overrideAccess false + no user = the public's view: drafts and trashed items are not found
  const found = await payload.find({ collection, where: { id: { equals: id } }, limit: 1, depth: 0, overrideAccess: false })
  if (found.docs.length) await countHit(kind as 'doc_link' | 'dashboard_view' | 'file_view' | 'guide_link', id as number)
  return new Response(null, { status: 204 })
}
