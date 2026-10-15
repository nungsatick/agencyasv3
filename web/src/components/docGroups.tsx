import React from 'react'

// Document groups as the public pages show them (documents page sections, home page "เอกสารล่าสุด"):
// title, a short name, a colour tone and a line icon. A group only appears when it has documents.
// Tones: committee work follows the province theme, statistical registers are teal, dataset work is indigo.
export type Tone = 'theme' | 'teal' | 'indigo' | 'gray'

export const GROUPS: { key: string; title: string; short: string; tone: Tone; icon: React.ReactNode }[] = [
  { key: 'meeting', title: 'การประชุมคณะกรรมการระดับจังหวัด', short: 'การประชุม', tone: 'theme', icon: <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 19a5.5 5.5 0 0 1 11 0M16 5.3a3 3 0 0 1 0 5.4M17.5 14a5.5 5.5 0 0 1 4 5" /> },
  { key: 'order', title: 'คำสั่งแต่งตั้งคณะกรรมการ', short: 'คำสั่ง', tone: 'theme', icon: <path d="M9 4h6v5a3 3 0 0 0 2 2.8V14H7v-2.200A3 3 0 0 0 9 9ZM5 14h14v3H5ZM4 20h16" /> },
  { key: 'official_stat', title: 'บัญชีสถิติทางการ', short: 'บัญชีสถิติทางการ', tone: 'teal', icon: <path d="M4 5h16v14H4ZM4 10h16M4 15h16M10 5v14" /> },
  { key: 'stat_plan', title: 'แผนพัฒนาสถิติ', short: 'แผนพัฒนาสถิติ', tone: 'teal', icon: <path d="M9 4h6v3H9ZM9 5.500H6v15h12v-15h-3M9 12l2 2 4-4M9 17h6" /> },
  { key: 'digital_catalog', title: 'บัญชีข้อมูลดิจิทัล', short: 'บัญชีข้อมูลดิจิทัล', tone: 'teal', icon: <path d="M5 6c0-1.700 3.100-3 7-3s7 1.300 7 3-3.100 3-7 3-7-1.300-7-3ZM5 6v6c0 1.700 3.100 3 7 3s7-1.300 7-3V6M5 12v6c0 1.700 3.100 3 7 3s7-1.300 7-3v-6" /> },
  { key: 'dataset', title: 'ชุดข้อมูลตามประเด็นการพัฒนา', short: 'ชุดข้อมูล', tone: 'indigo', icon: <path d="M12 3 3 8l9 5 9-5ZM3 12.500l9 5 9-5M3 17l9 5 9-5" /> },
  { key: 'analysis', title: 'ข้อกำหนดการวิเคราะห์', short: 'ข้อกำหนดการวิเคราะห์', tone: 'indigo', icon: <path d="M10.500 17a6.500 6.500 0 1 0 0-13 6.500 6.500 0 0 0 0 13ZM15.500 15.500 21 21M8 12.500v-2M10.500 12.500V8M13 12.500v-3" /> },
  { key: 'other', title: 'เอกสารอื่น', short: 'อื่นๆ', tone: 'gray', icon: <path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /> },
]

export const Svg = ({ size = 22, children }: { size?: number; children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)


export const groupOf = (key: string) => GROUPS.find((g) => g.key === key) ?? GROUPS[GROUPS.length - 1]
