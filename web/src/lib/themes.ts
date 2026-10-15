// Preset colour themes a province can choose. Every dark/primary colour is dark
// enough for white text; tint is the pale background for selected states.
export const themes = {
  ocean: { label: 'น้ำเงินทะเล', primary: '#0B5A7D', dark: '#083F58', deep: '#062C3E', tint: '#E6F0F5' },
  forest: { label: 'เขียวป่า', primary: '#1F6B3A', dark: '#154D29', deep: '#0E3A1E', tint: '#E6F2EA' },
  silk: { label: 'ม่วงผ้าไหม', primary: '#6D46A8', dark: '#4A2E7A', deep: '#35205A', tint: '#EFE9F7' },
  lac: { label: 'แดงครั่ง', primary: '#9A2B1F', dark: '#701D14', deep: '#52140D', tint: '#F7E8E6' },
  brick: { label: 'ส้มอิฐ', primary: '#B4510E', dark: '#8A3A08', deep: '#632905', tint: '#FBE9DD' },
  gold: { label: 'น้ำตาลทอง', primary: '#8A6410', dark: '#634708', deep: '#463204', tint: '#F6EFDC' },
  lotus: { label: 'ชมพูบัว', primary: '#A8326B', dark: '#7A214C', deep: '#591636', tint: '#F8E7EF' },
  slate: { label: 'เทาคราม', primary: '#3B4854', dark: '#232D36', deep: '#161D24', tint: '#EEF1F4' },
} as const

export type ThemeCode = keyof typeof themes

export const themeOptions = Object.entries(themes).map(([value, t]) => ({ label: t.label, value }))

export function themeVars(code: string | null | undefined): Record<string, string> {
  const t = themes[(code as ThemeCode) ?? 'ocean'] ?? themes.ocean
  return { '--primary': t.primary, '--dark': t.dark, '--deep': t.deep, '--tint': t.tint }
}

type TopicTone = { label: string; dot: string; text: string; bg: string }

// Colour sets a topic can use (picked in the backoffice). Each was chosen so its text colour
// reads on its own background and on white.
export const topicPalette: Record<string, TopicTone> = {
  orange: { label: 'ส้มอิฐ', dot: '#B4510E', text: '#8A3A08', bg: '#FBE9DD' },
  sea: { label: 'ฟ้าน้ำทะเล', dot: '#0B6E8A', text: '#07506A', bg: '#E2F1F6' },
  gold: { label: 'น้ำตาลทอง', dot: '#8A6410', text: '#6B4A12', bg: '#F6EFDC' },
  purple: { label: 'ม่วง', dot: '#6D46A8', text: '#5B3A8C', bg: '#EFE9F7' },
  leaf: { label: 'เขียวใบไม้', dot: '#3F7A28', text: '#2F5D1E', bg: '#E8F3E2' },
  pink: { label: 'ชมพูเข้ม', dot: '#A8326B', text: '#7A214C', bg: '#F8E7EF' },
  brown: { label: 'น้ำตาล', dot: '#7A5A1E', text: '#5C4315', bg: '#F3EBDD' },
  red: { label: 'แดงเลือดหมู', dot: '#9A2B1F', text: '#701D14', bg: '#F7E8E6' },
  slate: { label: 'เทาเข้ม', dot: '#3B4854', text: '#232D36', bg: '#EEF1F4' },
  blue: { label: 'น้ำเงิน', dot: '#2E5AAC', text: '#1F3F7C', bg: '#E6EDF8' },
  forest: { label: 'เขียวป่า', dot: '#1F6B3A', text: '#154D29', bg: '#E6F2EA' },
  navy: { label: 'น้ำเงินเข้ม', dot: '#0B5A7D', text: '#083F58', bg: '#E6F0F5' },
  gray: { label: 'เทา', dot: '#51606E', text: '#3B4854', bg: '#EEF1F4' },
  teal: { label: 'เขียวน้ำทะเล', dot: '#0F7C6E', text: '#0B5A50', bg: '#E0F2EF' },
}
export const topicPaletteOptions = Object.entries(topicPalette).map(([value, t]) => ({ label: t.label, value }))

// The colour each of the original 13 topics had before colours became editable.
const legacyTone: Record<string, string> = {
  disaster: 'orange', water: 'sea', waste: 'gold', elderly: 'purple', agriculture: 'leaf', tourism: 'pink', economy: 'brown',
  health: 'red', safety: 'slate', education: 'blue', environment: 'forest', province_overview: 'navy', other: 'gray',
}

/** Colours of a topic: the one picked in the backoffice, else its original one, else grey. */
export function topicColor(topic: { slug?: string | null; color?: string | null } | null | undefined): TopicTone {
  const key = topic?.color || legacyTone[topic?.slug ?? ''] || 'gray'
  return topicPalette[key] ?? topicPalette.gray
}
