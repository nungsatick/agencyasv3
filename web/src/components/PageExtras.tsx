import React from 'react'

import { activePopups } from '@/lib/site'

import { AnnouncementQueue, VisitBeacon } from './Consent'

/** Per-page add-ons for the public pages: the visit counter and the active announcements. */
export async function PageExtras({ province, page }: { province: { id: number; slug: string }; page: 'home' | 'docs' | 'utilization' | 'guides' }) {
  const popups = await activePopups(province.id, page)
  return (
    <>
      <VisitBeacon slug={province.slug} page={page} />
      {popups.length > 0 && <AnnouncementQueue popups={popups} provinceId={province.id} />}
    </>
  )
}
