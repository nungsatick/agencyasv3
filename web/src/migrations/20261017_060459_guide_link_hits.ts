import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_hit_counts_kind" ADD VALUE 'guide_link';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "hit_counts" ALTER COLUMN "kind" SET DATA TYPE text;
  DROP TYPE "public"."enum_hit_counts_kind";
  CREATE TYPE "public"."enum_hit_counts_kind" AS ENUM('file_view', 'file_download', 'doc_link', 'dashboard_view');
  ALTER TABLE "hit_counts" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_hit_counts_kind" USING "kind"::"public"."enum_hit_counts_kind";`)
}
