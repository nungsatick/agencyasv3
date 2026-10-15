import React from 'react'

import { AuthFlow } from '@/components/AuthFlow'
import { AuthShell } from '@/components/AuthShell'

export const metadata = { title: 'เปิดใช้บัญชี · ระบบสนับสนุนการจัดทำบัญชีข้อมูลจังหวัด', robots: { index: false } }

export default async function ActivatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <AuthShell split>
      <AuthFlow token={token} />
    </AuthShell>
  )
}
