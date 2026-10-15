import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "dashboards" ADD COLUMN "pinned" boolean DEFAULT false;
  ALTER TABLE "_dashboards_v" ADD COLUMN "version_pinned" boolean DEFAULT false;
  CREATE INDEX "dashboards_pinned_idx" ON "dashboards" USING btree ("pinned");
  CREATE INDEX "_dashboards_v_version_version_pinned_idx" ON "_dashboards_v" USING btree ("version_pinned");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "dashboards_pinned_idx";
  DROP INDEX "_dashboards_v_version_version_pinned_idx";
  ALTER TABLE "dashboards" DROP COLUMN "pinned";
  ALTER TABLE "_dashboards_v" DROP COLUMN "version_pinned";`)
}
