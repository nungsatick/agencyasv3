import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_topics_color" ADD VALUE 'teal';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "topics" ALTER COLUMN "color" SET DATA TYPE text;
  DROP TYPE "public"."enum_topics_color";
  CREATE TYPE "public"."enum_topics_color" AS ENUM('orange', 'sea', 'gold', 'purple', 'leaf', 'pink', 'brown', 'red', 'slate', 'blue', 'forest', 'navy', 'gray');
  ALTER TABLE "topics" ALTER COLUMN "color" SET DATA TYPE "public"."enum_topics_color" USING "color"::"public"."enum_topics_color";`)
}
