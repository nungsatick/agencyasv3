import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_activity_logs_action" ADD VALUE 'idle_sign_out' BEFORE 'create';
  CREATE TABLE "session_activity" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"sid" varchar NOT NULL,
  	"user_id" numeric NOT NULL,
  	"last_seen" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "session_activity_id" integer;
  CREATE UNIQUE INDEX "session_activity_sid_idx" ON "session_activity" USING btree ("sid");
  CREATE INDEX "session_activity_user_id_idx" ON "session_activity" USING btree ("user_id");
  CREATE INDEX "session_activity_last_seen_idx" ON "session_activity" USING btree ("last_seen");
  CREATE INDEX "session_activity_updated_at_idx" ON "session_activity" USING btree ("updated_at");
  CREATE INDEX "session_activity_created_at_idx" ON "session_activity" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_session_activity_fk" FOREIGN KEY ("session_activity_id") REFERENCES "public"."session_activity"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_session_activity_id_idx" ON "payload_locked_documents_rels" USING btree ("session_activity_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "session_activity" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "session_activity" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_session_activity_fk";
  
  ALTER TABLE "activity_logs" ALTER COLUMN "action" SET DATA TYPE text;
  DROP TYPE "public"."enum_activity_logs_action";
  CREATE TYPE "public"."enum_activity_logs_action" AS ENUM('sign_in', 'sign_in_locked', 'create', 'update', 'publish', 'unpublish', 'trash', 'restore', 'delete', 'upload', 'replace_file', 'user_invite', 'user_link', 'user_reset_2fa', 'user_suspend', 'user_unsuspend', 'password_change', 'auto_suspend', 'auto_purge');
  ALTER TABLE "activity_logs" ALTER COLUMN "action" SET DATA TYPE "public"."enum_activity_logs_action" USING "action"::"public"."enum_activity_logs_action";
  DROP INDEX "payload_locked_documents_rels_session_activity_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "session_activity_id";`)
}
