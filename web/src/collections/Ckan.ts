import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access'

// A copy of the province datasets listed on the national CKAN portals (gdcatalog.go.th and
// statprovince.gdcatalog.go.th), refreshed by lib/ckanSync.ts. Only titles, descriptions and links:
// the data itself stays on the portals. Written by the sync job only, read through lib/ckanSearch.ts.
export const CkanDatasets: CollectionConfig = {
  slug: 'ckan-datasets',
  admin: { hidden: true },
  access: { read: isAdmin, create: () => false, update: () => false, delete: () => false },
  fields: [
    // "<source>:<dataset id>:<province code>": one row per dataset and province (statprovince datasets cover many provinces)
    { name: 'key', type: 'text', required: true, unique: true },
    { name: 'source', type: 'text', required: true, index: true }, // gdcatalog | statprovince
    { name: 'province', type: 'relationship', relationTo: 'provinces', required: true, index: true },
    { name: 'ckanId', type: 'text', required: true },
    { name: 'ckanName', type: 'text' },
    { name: 'title', type: 'text', required: true },
    { name: 'notes', type: 'textarea' },
    { name: 'orgTitle', type: 'text' },
    { name: 'dataType', type: 'text' },
    { name: 'url', type: 'text', required: true },
    { name: 'tags', type: 'json' }, // string[]
    { name: 'groups', type: 'json' }, // string[], topic groups (province groups left out)
    { name: 'formats', type: 'json' }, // string[], e.g. ["CSV", "XLSX"]
    { name: 'resources', type: 'json' }, // { id, name, format, url, datastore }[]
    { name: 'modifiedAt', type: 'date' },
    { name: 'syncedAt', type: 'date', required: true, index: true },
  ],
}

// One line per sync run, for the status shown in the backoffice.
export const CkanSyncRuns: CollectionConfig = {
  slug: 'ckan-sync-runs',
  admin: { hidden: true },
  defaultSort: '-startedAt',
  access: { read: isAdmin, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'source', type: 'text', required: true },
    { name: 'startedAt', type: 'date', required: true, index: true },
    { name: 'finishedAt', type: 'date' },
    { name: 'status', type: 'text', required: true }, // running | ok | failed
    { name: 'fetched', type: 'number' },
    { name: 'removed', type: 'number' },
    { name: 'note', type: 'textarea' },
  ],
}
