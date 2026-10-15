import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { th } from '@payloadcms/translations/languages/th'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { CentralContents, Dashboards, Documents, Files } from './collections/Content'
import { DocumentTypes, Provinces, Topics } from './collections/Reference'
import { createLinkFor } from './endpoints/auth'
import { overviewExport } from './endpoints/overviewExport'
import { randomPassword } from './lib/auth'
import { scheduleMaintenance } from './lib/maintenance'
import { migrations } from './migrations'
import { ActivityLogs, Announcements, CookieConsents, HitCounts, PageViews, SiteSettings } from './collections/Site'
import { SessionActivity, Users, UserTokens } from './collections/Users'
import { AccountRequests } from './collections/AccountRequests'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: { titleSuffix: ' · ระบบสนับสนุนการจัดทำบัญชีข้อมูลจังหวัด', icons: [{ rel: 'icon', type: 'image/png', url: '/brand/favicon.png' }] },
    theme: 'light',
    // Payload's own dates (document header, versions); PayloadDates turns the year into พ.ศ. (lib/thaiDate.ts)
    dateFormat: 'd MMM yyyy - HH.mm น.',
    avatar: { Component: '/components/admin/Avatar#Avatar' },
    components: {
      graphics: { Logo: '/components/admin/Brand#Logo', Icon: '/components/admin/Brand#Icon' },
      beforeNavLinks: ['/components/admin/Brand#NavExtras'],
      afterNavLinks: ['/components/admin/Brand#LogoutLink'],
      providers: ['/components/admin/FieldHints#FieldHints'],
      beforeDashboard: ['/components/admin/Overview#Overview'],
      views: {
        userTools: { Component: '/components/admin/UserToolsView#UserToolsView', path: '/user-tools', meta: { title: 'เพิ่มและนำเข้าผู้ใช้' } },
        visitStats: { Component: '/components/admin/StatsView#StatsView', path: '/visit-stats', meta: { title: 'สถิติการเข้าชม' } },
        // our list screens (one look for every list); /admin/collections/<slug> redirects here, see proxy.ts
        documentsList: { Component: '/components/admin/lists/pages#DocumentsListView', path: '/documents', meta: { title: 'เอกสาร' } },
        dashboardsList: { Component: '/components/admin/lists/pages#DashboardsListView', path: '/dashboards', meta: { title: 'แดชบอร์ด' } },
        filesList: { Component: '/components/admin/lists/pages#FilesListView', path: '/files', meta: { title: 'ไฟล์' } },
        centralContentsList: { Component: '/components/admin/lists/pages#CentralContentsListView', path: '/central-contents', meta: { title: 'เนื้อหากลาง' } },
        announcementsList: { Component: '/components/admin/lists/pages#AnnouncementsListView', path: '/announcements', meta: { title: 'ประกาศ' } },
        provincesList: { Component: '/components/admin/lists/pages#ProvincesListView', path: '/provinces', meta: { title: 'จังหวัด' } },
        topicsList: { Component: '/components/admin/lists/pages#TopicsListView', path: '/topics', meta: { title: 'ประเด็น' } },
        documentTypesList: { Component: '/components/admin/lists/pages#DocumentTypesListView', path: '/document-types', meta: { title: 'ประเภทเอกสาร' } },
        accountRequestsList: { Component: '/components/admin/lists/pages#AccountRequestsListView', path: '/account-requests', meta: { title: 'คำขอบัญชี' } },
        usersList: { Component: '/components/admin/lists/pages#UsersListView', path: '/users', meta: { title: 'ผู้ใช้' } },
        activityLogsList: { Component: '/components/admin/lists/pages#ActivityLogsListView', path: '/activity-logs', meta: { title: 'ประวัติการใช้งาน' } },
        topicReport: { Component: '/components/admin/TopicReportView#TopicReportView', path: '/topic-report', meta: { title: 'รายงานประเด็น' } },
        reviewQueue: { Component: '/components/admin/ReviewView#ReviewView', path: '/review', meta: { title: 'รายการรอตรวจ' } },
        provinceSites: { Component: '/components/admin/ProvinceSitesView#ProvinceSitesView', path: '/province-sites', meta: { title: 'เว็บไซต์ 76 จังหวัด' } },
        trash: { Component: '/components/admin/TrashView#TrashView', path: '/trash', meta: { title: 'ถังขยะ' } },
        myAccount: { Component: '/components/admin/MyAccountView#MyAccountView', path: '/my-account', meta: { title: 'บัญชีของฉัน' } },
      },
    },
  },
  // Thai only: the backoffice never falls back to English, whatever the browser asks for.
  i18n: {
    supportedLanguages: { th },
    fallbackLanguage: 'th',
    // the backoffice home is called "ภาพรวม" everywhere; Payload's own word ("แดชบอร์ด") clashed with the dashboards menu
    translations: { th: { general: { dashboard: 'ภาพรวม' } } },
  },
  // The "API" tab on edit pages shows the raw JSON of a record, which is for developers only, so it is hidden
  // everywhere. The REST API itself is unchanged (the backoffice and the import use it).
  collections: [Documents, Dashboards, Files, CentralContents, Announcements, Provinces, Topics, DocumentTypes, Users, AccountRequests, UserTokens, SessionActivity, ActivityLogs, PageViews, HitCounts, CookieConsents].map(
    (c) => ({ ...c, admin: { ...c.admin, hideAPIURL: true } }),
  ),
  endpoints: [{ path: '/overview-export', method: 'get', handler: overviewExport }],
  globals: [SiteSettings].map((g) => ({ ...g, admin: { ...g.admin, hideAPIURL: true } })),
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    // Development pushes the schema automatically; production applies these migrations at start-up.
    prodMigrations: migrations,
  }),
  // First start of a new installation: there is no account yet and no screen to make one,
  // so create the first central admin from the environment and print its one-time activation
  // link to the server log. No password is ever put in the environment.
  onInit: async (payload) => {
    // auto-suspend accounts unused for 365 days, empty the trash after 30 days
    scheduleMaintenance(payload)
    const username = process.env.FIRST_ADMIN_USERNAME?.trim().toLowerCase()
    if (!username) return
    const { totalDocs } = await payload.count({ collection: 'users' })
    if (totalDocs > 0) return
    const user = await payload.create({
      collection: 'users',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { username, name: process.env.FIRST_ADMIN_NAME || username, role: 'admin', password: randomPassword(), status: 'invited' } as any,
      context: { internal: true },
    })
    const link = await createLinkFor(payload, user, 'activation', process.env.SITE_URL || 'http://localhost:3000')
    payload.logger.info(`First admin "${username}" created. One-time activation link (valid 14 days): ${link.url}`)
  },
  sharp,
  plugins: [],
})
