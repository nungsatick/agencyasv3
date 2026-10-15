import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React, { Suspense } from 'react'

import { Analytics } from '@/components/Analytics'
import { MourningRibbon, SiteFooter } from '@/components/Chrome'
import { ConsentProvider } from '@/components/Consent'
import { BackToTop } from '@/components/Tools'
import { getProvince } from '@/lib/data'
import { activeMourning, analyticsId, getSettings } from '@/lib/site'
import { themeVars } from '@/lib/themes'

type Props = { children: React.ReactNode; params: Promise<{ province: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const province = await getProvince((await params).province)
  if (!province) return {}
  return { title: `ระบบสนับสนุนการจัดทำบัญชีข้อมูล จังหวัด${province.nameTh}` }
}

export default async function ProvinceLayout({ children, params }: Props) {
  const province = await getProvince((await params).province)
  if (!province) notFound()
  const [settings, mourning, gaId] = await Promise.all([getSettings(), activeMourning(), analyticsId()])

  const classes = ['site']
  if (mourning?.grayscale) classes.push('is-mourning')
  if (mourning?.grayscale && mourning.keepEmbeds) classes.push('is-mourning--keep-embeds')
  if (mourning?.ribbon) classes.push(`has-ribbon--${mourning.corner}`)

  return (
    <div
      className={classes.join(' ')}
      style={{ ...themeVars(province.theme), ...(mourning?.grayscale ? { '--mourn-gray': mourning.grayLevel / 100 } : {}) } as React.CSSProperties}
    >
      <ConsentProvider scope={province.slug} policyVersion={settings.policyVersion ?? 1} analyticsTool={gaId ? 'Google Analytics' : null}>
        {gaId && (
          <Suspense fallback={null}>
            <Analytics id={gaId} province={province.slug} />
          </Suspense>
        )}
        {mourning?.ribbon && <MourningRibbon corner={mourning.corner} />}
        {/* pages render their own header; the note sits right under it via CSS order */}
        <div className="site__pages">
          {children}
          {mourning?.message && <div className="mourning-note">{mourning.message}</div>}
        </div>
        <SiteFooter province={province} />
        <BackToTop />
      </ConsentProvider>
    </div>
  )
}
