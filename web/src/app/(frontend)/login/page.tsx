import React from 'react'

import { AuthFlow } from '@/components/AuthFlow'
import { AuthShell } from '@/components/AuthShell'

export const metadata = { title: 'เข้าสู่ระบบ · ระบบสนับสนุนการจัดทำบัญชีข้อมูลจังหวัด' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  // sent here by the backoffice after 30 minutes without use
  const idle = (await searchParams).reason === 'idle'
  return (
    <AuthShell split cityBackground>
      <AuthFlow notice={idle ? 'ออกจากระบบอัตโนมัติแล้ว เพราะไม่ได้ใช้งานเกิน 30 นาที กรุณาเข้าสู่ระบบอีกครั้ง' : undefined} />
    </AuthShell>
  )
}
