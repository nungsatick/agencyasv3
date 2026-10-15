import { type NextRequest, NextResponse } from 'next/server'

const LISTS = new Set(['documents', 'dashboards', 'files', 'central-contents', 'announcements', 'provinces', 'topics', 'document-types', 'users', 'account-requests', 'activity-logs'])

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  // Every list menu opens our own list screen (plain drop-down filters, clear edit / view buttons).
  // Payload's list stays reachable with ?advanced=1 (bulk actions); create and edit pages are untouched.
  const list = /^\/admin\/collections\/([a-z-]+)$/.exec(pathname)?.[1]
  // one trash screen for documents and dashboards
  const trash = /^\/admin\/collections\/(documents|dashboards)\/trash$/.exec(pathname)?.[1]
  if (trash) return NextResponse.redirect(new URL(trash === 'documents' ? '/admin/trash' : '/admin/trash?kind=dashboards', request.url))
  if (pathname.startsWith('/admin/collections/')) {
    if (!list || !LISTS.has(list) || searchParams.get('advanced') === '1') return NextResponse.next()
    return NextResponse.redirect(new URL(`/admin/${list}`, request.url))
  }
  // Payload's built-in sign-in screens are replaced by /login (username + password + 2FA).
  // Email-based password recovery does not exist, so those screens lead to /login as well.
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/admin/login', '/admin/forgot', '/admin/reset/:path*', '/admin/create-first-user', '/admin/collections/:slug', '/admin/collections/:slug/trash'],
}
