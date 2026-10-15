'use client'

import { useEffect } from 'react'

import { fixPayloadDate, PAYLOAD_DATE } from '@/lib/thaiDate'

const matches = (t: string) => {
  PAYLOAD_DATE.lastIndex = 0
  return PAYLOAD_DATE.test(t)
}

function fixText(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = node.nodeValue ?? ''
    if (matches(t)) node.nodeValue = fixPayloadDate(t)
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const t = n.nodeValue ?? ''
    if (matches(t)) n.nodeValue = fixPayloadDate(t)
  }
}

/**
 * Payload writes its own dates (document header "แก้ไขล่าสุดเมื่อ", versions) with the Christian year.
 * They come out as "14 ต.ค. 2026 - 17.01 น." (admin.dateFormat); this turns them into "14 ต.ค. 69 - 17.01 น.".
 */
export function PayloadDates() {
  useEffect(() => {
    fixText(document.body)
    const obs = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'characterData') fixText(r.target)
        else r.addedNodes.forEach(fixText)
      }
    })
    obs.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => obs.disconnect()
  }, [])
  return null
}
