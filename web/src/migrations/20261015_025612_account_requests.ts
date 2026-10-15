import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_account_requests_status" AS ENUM('pending', 'approved', 'rejected');
  ALTER TYPE "public"."enum_activity_logs_action" ADD VALUE 'account_request' BEFORE 'user_link';
  ALTER TYPE "public"."enum_activity_logs_action" ADD VALUE 'account_request_approve' BEFORE 'user_link';
  ALTER TYPE "public"."enum_activity_logs_action" ADD VALUE 'account_request_reject' BEFORE 'user_link';
  CREATE TABLE "account_requests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"province_id" integer NOT NULL,
  	"position" varchar,
  	"unit" varchar,
  	"phone" varchar NOT NULL,
  	"email" varchar,
  	"note" varchar,
  	"status" "enum_account_requests_status" DEFAULT 'pending' NOT NULL,
  	"decided_by_id" integer,
  	"decided_at" timestamp(3) with time zone,
  	"user_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "account_requests_id" integer;
  ALTER TABLE "account_requests" ADD CONSTRAINT "account_requests_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "account_requests" ADD CONSTRAINT "account_requests_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "account_requests" ADD CONSTRAINT "account_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "account_requests_province_idx" ON "account_requests" USING btree ("province_id");
  CREATE INDEX "account_requests_status_idx" ON "account_requests" USING btree ("status");
  CREATE INDEX "account_requests_decided_by_idx" ON "account_requests" USING btree ("decided_by_id");
  CREATE INDEX "account_requests_user_idx" ON "account_requests" USING btree ("user_id");
  CREATE INDEX "account_requests_updated_at_idx" ON "account_requests" USING btree ("updated_at");
  CREATE INDEX "account_requests_created_at_idx" ON "account_requests" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_account_requests_fk" FOREIGN KEY ("account_requests_id") REFERENCES "public"."account_requests"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_account_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("account_requests_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "account_requests" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "account_requests" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_account_requests_fk";
  
  ALTER TABLE "activity_logs" ALTER COLUMN "action" SET DATA TYPE text;
  DROP TYPE "public"."enum_activity_logs_action";
  CREATE TYPE "public"."enum_activity_logs_action" AS ENUM('sign_in', 'sign_in_locked', 'idle_sign_out', 'create', 'update', 'publish', 'unpublish', 'trash', 'restore', 'delete', 'upload', 'replace_file', 'user_invite', 'user_link', 'user_reset_2fa', 'user_suspend', 'user_unsuspend', 'password_change', 'auto_suspend', 'auto_purge');
  ALTER TABLE "activity_logs" ALTER COLUMN "action" SET DATA TYPE "public"."enum_activity_logs_action" USING "action"::"public"."enum_activity_logs_action";
  DROP INDEX "payload_locked_documents_rels_account_requests_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "account_requests_id";
  DROP TYPE "public"."enum_account_requests_status";`)
}
