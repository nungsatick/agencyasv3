import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_topics_color" AS ENUM('orange', 'sea', 'gold', 'purple', 'leaf', 'pink', 'brown', 'red', 'slate', 'blue', 'forest', 'navy', 'gray');
  ALTER TABLE "topics" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "topics" ADD COLUMN "color" "enum_topics_color";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "topics" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "topics" DROP COLUMN "color";
  DROP TYPE "public"."enum_topics_color";`)
}
