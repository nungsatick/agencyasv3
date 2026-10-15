import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_activity_logs_action" AS ENUM('sign_in', 'sign_in_locked', 'create', 'update', 'publish', 'unpublish', 'trash', 'restore', 'delete', 'upload', 'replace_file', 'user_invite', 'user_link', 'user_reset_2fa', 'user_suspend', 'user_unsuspend', 'password_change', 'auto_suspend', 'auto_purge');
  CREATE TYPE "public"."enum_hit_counts_kind" AS ENUM('file_view', 'file_download', 'doc_link', 'dashboard_view');
  CREATE TABLE "activity_logs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"username" varchar,
  	"user_id" integer,
  	"action" "enum_activity_logs_action" NOT NULL,
  	"area" varchar,
  	"subject" varchar,
  	"province_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "hit_counts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_hit_counts_kind" NOT NULL,
  	"ref_id" numeric NOT NULL,
  	"hits" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "site_settings" ALTER COLUMN "show_visit_stats" SET DEFAULT false;
  ALTER TABLE "provinces" ADD COLUMN "hero_focus_x" numeric DEFAULT 50;
  ALTER TABLE "provinces" ADD COLUMN "hero_focus_y" numeric DEFAULT 40;
  ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "activity_logs_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "hit_counts_id" integer;
  ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "activity_logs_username_idx" ON "activity_logs" USING btree ("username");
  CREATE INDEX "activity_logs_user_idx" ON "activity_logs" USING btree ("user_id");
  CREATE INDEX "activity_logs_action_idx" ON "activity_logs" USING btree ("action");
  CREATE INDEX "activity_logs_province_idx" ON "activity_logs" USING btree ("province_id");
  CREATE INDEX "activity_logs_updated_at_idx" ON "activity_logs" USING btree ("updated_at");
  CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs" USING btree ("created_at");
  CREATE INDEX "hit_counts_ref_id_idx" ON "hit_counts" USING btree ("ref_id");
  CREATE INDEX "hit_counts_updated_at_idx" ON "hit_counts" USING btree ("updated_at");
  CREATE INDEX "hit_counts_created_at_idx" ON "hit_counts" USING btree ("created_at");
  CREATE UNIQUE INDEX "kind_refId_idx" ON "hit_counts" USING btree ("kind","ref_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activity_logs_fk" FOREIGN KEY ("activity_logs_id") REFERENCES "public"."activity_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_hit_counts_fk" FOREIGN KEY ("hit_counts_id") REFERENCES "public"."hit_counts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_activity_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("activity_logs_id");
  CREATE INDEX "payload_locked_documents_rels_hit_counts_id_idx" ON "payload_locked_documents_rels" USING btree ("hit_counts_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activity_logs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "hit_counts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "activity_logs" CASCADE;
  DROP TABLE "hit_counts" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_activity_logs_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_hit_counts_fk";
  
  DROP INDEX "payload_locked_documents_rels_activity_logs_id_idx";
  DROP INDEX "payload_locked_documents_rels_hit_counts_id_idx";
  ALTER TABLE "site_settings" ALTER COLUMN "show_visit_stats" SET DEFAULT true;
  ALTER TABLE "provinces" DROP COLUMN "hero_focus_x";
  ALTER TABLE "provinces" DROP COLUMN "hero_focus_y";
  ALTER TABLE "users" DROP COLUMN "last_login_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "activity_logs_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "hit_counts_id";
  DROP TYPE "public"."enum_activity_logs_action";
  DROP TYPE "public"."enum_hit_counts_kind";`)
}
