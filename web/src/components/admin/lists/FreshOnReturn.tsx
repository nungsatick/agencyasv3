'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// render marks already shown in this browser tab
const shown = new Set<string>()

/**
 * Coming back to a list (breadcrumb, menu, Back) can reuse the copy the browser fetched earlier, so a title
 * just changed in the edit form still shows the old text. Each server render carries a fresh mark: the
 * first time it is shown nothing happens; shown again from the browser's copy, the list is fetched anew.
 */
export function FreshOnReturn({ mark }: { mark: string }) {
  const router = useRouter()
  useEffect(() => {
    if (shown.has(mark)) router.refresh()
    else shown.add(mark)
  }, [mark, router])
  return null
}
