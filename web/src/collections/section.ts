import type { Field } from 'payload'

/**
 * A titled block of fields on an edit screen. It only groups fields on screen — the data keeps
 * its shape — and custom.scss draws it as a card with a header.
 */
export const section = (label: string, fields: Field[], description?: string): Field => ({
  type: 'collapsible',
  label,
  fields,
  admin: { initCollapsed: false, className: 'agy-sec', ...(description ? { description } : {}) },
})
