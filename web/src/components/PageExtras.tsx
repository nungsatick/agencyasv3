import React from 'react'

import { activePopup } from '@/lib/site'

import { AnnouncementPopup, VisitBeacon } from './Consent'

/** Per-page add-ons for the public pages: the visit counter and any active announcement. */
export async function PageExtras({ province, page }: { province: { id: number; slug: string }; page: 'home' | 'docs' | 'utilization' | 'guides' }) {
  const popup = await activePopup(province.id, page)
  return (
    <>
      <VisitBeacon slug={province.slug} page={page} />
      {popup && <AnnouncementPopup popup={popup} />}
    </>
  )
}
