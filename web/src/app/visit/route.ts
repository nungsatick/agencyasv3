import { countVisit } from '@/lib/site'

// POST /visit { slug, page } — one anonymous page view. Nothing about the visitor is stored.
export async function POST(req: Request) {
  const { slug, page } = (await req.json().catch(() => ({}))) as { slug?: string; page?: string }
  if (typeof slug !== 'string' || typeof page !== 'string') return new Response(null, { status: 400 })
  const signedIn = /(?:^|;\s*)payload-token=/.test(req.headers.get('cookie') ?? '')
  const counted = await countVisit(slug, page, req.headers.get('user-agent') ?? '', signedIn)
  return Response.json({ counted })
}
