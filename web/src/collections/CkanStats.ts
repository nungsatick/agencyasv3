import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access'

// What visitors type into the province data search, counted per day and province: the words only,
// no address, no visitor id. Words that look like a phone or ID number or an email are not kept.
// Rows older than a year are removed by the nightly CKAN job (lib/ckanSync.ts).
export const CkanSearchStats: CollectionConfig = {
  slug: 'ckan-search-stats',
  admin: { hidden: true },
  access: { read: isAdmin, create: () => false, update: () => false, delete: () => false },
  indexes: [{ fields: ['day', 'province', 'query'], unique: true }],
  fields: [
    { name: 'day', type: 'text', required: true, index: true }, // YYYY-MM-DD, Asia/Bangkok
    { name: 'province', type: 'relationship', relationTo: 'provinces', required: true },
    { name: 'query', type: 'text', required: true },
    { name: 'searches', type: 'number', required: true, defaultValue: 0 },
    { name: 'misses', type: 'number', required: true, defaultValue: 0 }, // searches that found nothing
  ],
}
