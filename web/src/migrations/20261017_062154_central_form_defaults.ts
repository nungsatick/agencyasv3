import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "central_contents" ALTER COLUMN "section" SET DEFAULT 'plan';
  ALTER TABLE "central_contents" ALTER COLUMN "sort_order" DROP DEFAULT;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "central_contents" ALTER COLUMN "section" DROP DEFAULT;
  ALTER TABLE "central_contents" ALTER COLUMN "sort_order" SET DEFAULT 0;`)
}
