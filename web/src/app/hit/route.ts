import config from '@payload-config'
import { getPayload } from 'payload'

import { countHit, uncounted } from '@/lib/site'

// POST /hit { kind: 'doc_link' | 'dashboard_view', id } — a visitor opened a document's external
// link or a dashboard. Only published items are counted; nothing about the visitor is stored.
export async function POST(req: Request) {
  const { kind, id } = (await req.json().catch(() => ({}))) as { kind?: string; id?: number }
  const collection = kind === 'doc_link' ? 'documents' : kind === 'dashboard_view' ? 'dashboards' : null
  if (!collection || !Number.isInteger(id)) return new Response(null, { status: 400 })
  if (uncounted(req.headers.get('user-agent'), req.headers.get('cookie'))) return new Response(null, { status: 204 })
  const payload = await getPayload({ config })
  // overrideAccess false + no user = the public's view: drafts and trashed items are not found
  const found = await payload.find({ collection, where: { id: { equals: id } }, limit: 1, depth: 0, overrideAccess: false })
  if (found.docs.length) await countHit(kind as 'doc_link' | 'dashboard_view', id as number)
  return new Response(null, { status: 204 })
}
