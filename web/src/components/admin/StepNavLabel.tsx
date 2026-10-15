'use client'

import { useStepNav } from '@payloadcms/ui'
import { useEffect } from 'react'

/**
 * Sets the breadcrumb at the top of the backoffice for one of our own screens.
 * Payload's own screens set it themselves; ours must too, or the previous screen's title stays there.
 */
export function StepNavLabel({ label }: { label?: string }) {
  const { setStepNav } = useStepNav()
  useEffect(() => {
    setStepNav(label ? [{ label }] : [])
  }, [label, setStepNav])
  return null
}
