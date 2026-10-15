import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_documents_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__documents_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_dashboards_provider" AS ENUM('powerbi', 'arcgis', 'looker', 'other', 'none');
  CREATE TYPE "public"."enum_dashboards_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__dashboards_v_version_provider" AS ENUM('powerbi', 'arcgis', 'looker', 'other', 'none');
  CREATE TYPE "public"."enum__dashboards_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_central_contents_section" AS ENUM('plan', 'howto');
  CREATE TYPE "public"."enum_announcements_show_on" AS ENUM('home', 'all');
  CREATE TYPE "public"."enum_announcements_frequency" AS ENUM('daily', 'once', 'always');
  CREATE TYPE "public"."enum_announcements_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__announcements_v_version_show_on" AS ENUM('home', 'all');
  CREATE TYPE "public"."enum__announcements_v_version_frequency" AS ENUM('daily', 'once', 'always');
  CREATE TYPE "public"."enum__announcements_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_provinces_theme" AS ENUM('ocean', 'forest', 'silk', 'lac', 'brick', 'gold', 'lotus', 'slate');
  CREATE TYPE "public"."enum_provinces_hero_text_side" AS ENUM('left', 'right');
  CREATE TYPE "public"."enum_document_types_group" AS ENUM('meeting', 'order', 'official_stat', 'digital_catalog', 'stat_plan', 'dataset', 'analysis', 'other');
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'province_manager', 'province_editor');
  CREATE TYPE "public"."enum_users_status" AS ENUM('invited', 'active', 'suspended');
  CREATE TYPE "public"."enum_user_tokens_purpose" AS ENUM('activation', 'password_reset');
  CREATE TYPE "public"."enum_page_views_page" AS ENUM('home', 'docs', 'utilization', 'guides');
  CREATE TYPE "public"."enum_site_settings_mourning_ribbon_corner" AS ENUM('left', 'right');
  CREATE TABLE "documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"province_id" integer,
  	"fiscal_year" numeric,
  	"type_id" integer,
  	"title" varchar,
  	"meeting_no" numeric,
  	"meeting_date" timestamp(3) with time zone,
  	"topic_id" integer,
  	"issue_title" varchar,
  	"description" varchar,
  	"external_url" varchar,
  	"sort_order" numeric DEFAULT 0,
  	"legacy_id" numeric,
  	"legacy_title" varchar,
  	"needs_review" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "enum_documents_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"files_id" integer
  );
  
  CREATE TABLE "_documents_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_province_id" integer,
  	"version_fiscal_year" numeric,
  	"version_type_id" integer,
  	"version_title" varchar,
  	"version_meeting_no" numeric,
  	"version_meeting_date" timestamp(3) with time zone,
  	"version_topic_id" integer,
  	"version_issue_title" varchar,
  	"version_description" varchar,
  	"version_external_url" varchar,
  	"version_sort_order" numeric DEFAULT 0,
  	"version_legacy_id" numeric,
  	"version_legacy_title" varchar,
  	"version_needs_review" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "enum__documents_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_documents_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"files_id" integer
  );
  
  CREATE TABLE "dashboards" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"province_id" integer,
  	"fiscal_year" numeric,
  	"topic_id" integer,
  	"title" varchar,
  	"description" varchar,
  	"provider" "enum_dashboards_provider" DEFAULT 'powerbi',
  	"embed_url" varchar,
  	"thumbnail_id" integer,
  	"sort_order" numeric DEFAULT 0,
  	"legacy_id" numeric,
  	"legacy_title" varchar,
  	"needs_review" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "enum_dashboards_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "dashboards_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"files_id" integer
  );
  
  CREATE TABLE "_dashboards_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_province_id" integer,
  	"version_fiscal_year" numeric,
  	"version_topic_id" integer,
  	"version_title" varchar,
  	"version_description" varchar,
  	"version_provider" "enum__dashboards_v_version_provider" DEFAULT 'powerbi',
  	"version_embed_url" varchar,
  	"version_thumbnail_id" integer,
  	"version_sort_order" numeric DEFAULT 0,
  	"version_legacy_id" numeric,
  	"version_legacy_title" varchar,
  	"version_needs_review" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "enum__dashboards_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_dashboards_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"files_id" integer
  );
  
  CREATE TABLE "files" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"original_name" varchar,
  	"public_path" varchar,
  	"sha256" varchar,
  	"legacy_url" varchar,
  	"change_note" varchar,
  	"version_no" numeric DEFAULT 1,
  	"is_current" boolean DEFAULT true,
  	"version_of_id" integer,
  	"uploaded_by_id" integer,
  	"download_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "central_contents_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"url" varchar,
  	"file_id" integer
  );
  
  CREATE TABLE "central_contents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"section" "enum_central_contents_section" NOT NULL,
  	"fiscal_year" numeric,
  	"slug" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar,
  	"source_url" varchar,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "central_contents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"files_id" integer
  );
  
  CREATE TABLE "announcements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"body" varchar,
  	"image_id" integer,
  	"image_alt" varchar,
  	"button_label" varchar,
  	"button_url" varchar,
  	"starts_at" timestamp(3) with time zone,
  	"ends_at" timestamp(3) with time zone,
  	"all_provinces" boolean DEFAULT true,
  	"show_on" "enum_announcements_show_on" DEFAULT 'home',
  	"frequency" "enum_announcements_frequency" DEFAULT 'daily',
  	"priority" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_announcements_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "announcements_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"provinces_id" integer
  );
  
  CREATE TABLE "_announcements_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_body" varchar,
  	"version_image_id" integer,
  	"version_image_alt" varchar,
  	"version_button_label" varchar,
  	"version_button_url" varchar,
  	"version_starts_at" timestamp(3) with time zone,
  	"version_ends_at" timestamp(3) with time zone,
  	"version_all_provinces" boolean DEFAULT true,
  	"version_show_on" "enum__announcements_v_version_show_on" DEFAULT 'home',
  	"version_frequency" "enum__announcements_v_version_frequency" DEFAULT 'daily',
  	"version_priority" numeric DEFAULT 0,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__announcements_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_announcements_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"provinces_id" integer
  );
  
  CREATE TABLE "provinces" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"code" varchar NOT NULL,
  	"name_th" varchar NOT NULL,
  	"ckan_url" varchar NOT NULL,
  	"office_name" varchar,
  	"address" varchar,
  	"phone" varchar,
  	"fax" varchar,
  	"email" varchar,
  	"website" varchar,
  	"map_url" varchar,
  	"theme" "enum_provinces_theme" DEFAULT 'ocean' NOT NULL,
  	"hero_image_id" integer,
  	"hero_text_side" "enum_provinces_hero_text_side" DEFAULT 'left',
  	"hero_credit" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "topics" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"name_th" varchar NOT NULL,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "document_types" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"name_th" varchar NOT NULL,
  	"group" "enum_document_types_group" NOT NULL,
  	"has_meeting_no" boolean DEFAULT false,
  	"has_topic" boolean DEFAULT false,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "users_recovery_codes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"hash" varchar NOT NULL,
  	"used_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"position" varchar,
  	"phone" varchar,
  	"role" "enum_users_role" DEFAULT 'province_editor' NOT NULL,
  	"status" "enum_users_status" DEFAULT 'active' NOT NULL,
  	"suspended_reason" varchar,
  	"totp_confirmed_at" timestamp(3) with time zone,
  	"password_set_at" timestamp(3) with time zone,
  	"totp_secret" varchar,
  	"code_attempts" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar,
  	"username" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"provinces_id" integer
  );
  
  CREATE TABLE "user_tokens" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"purpose" "enum_user_tokens_purpose" NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"used_at" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "page_views" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"province_id" integer NOT NULL,
  	"day" varchar NOT NULL,
  	"page" "enum_page_views_page" NOT NULL,
  	"views" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cookie_consents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"visitor_id" varchar NOT NULL,
  	"policy_version" numeric NOT NULL,
  	"analytics" boolean DEFAULT false NOT NULL,
  	"third_party" boolean DEFAULT false NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"documents_id" integer,
  	"dashboards_id" integer,
  	"files_id" integer,
  	"central_contents_id" integer,
  	"announcements_id" integer,
  	"provinces_id" integer,
  	"topics_id" integer,
  	"document_types_id" integer,
  	"users_id" integer,
  	"user_tokens_id" integer,
  	"page_views_id" integer,
  	"cookie_consents_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_settings_footer_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"mourning_enabled" boolean DEFAULT false,
  	"mourning_starts_on" timestamp(3) with time zone,
  	"mourning_ends_on" timestamp(3) with time zone,
  	"mourning_ribbon_corner" "enum_site_settings_mourning_ribbon_corner" DEFAULT 'left',
  	"mourning_grayscale" boolean DEFAULT true,
  	"mourning_ribbon" boolean DEFAULT true,
  	"mourning_keep_embeds" boolean DEFAULT false,
  	"mourning_message" varchar,
  	"copyright_text" varchar DEFAULT 'สำนักงานสถิติแห่งชาติ กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม',
  	"footer_note" varchar,
  	"show_staff_login" boolean DEFAULT true,
  	"show_map_link" boolean DEFAULT true,
  	"show_visit_stats" boolean DEFAULT true,
  	"policy_version" numeric DEFAULT 1 NOT NULL,
  	"privacy_policy" varchar,
  	"cookie_policy" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "documents" ADD CONSTRAINT "documents_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_type_id_document_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."document_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents_rels" ADD CONSTRAINT "documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "documents_rels" ADD CONSTRAINT "documents_rels_files_fk" FOREIGN KEY ("files_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_documents_v" ADD CONSTRAINT "_documents_v_parent_id_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_documents_v" ADD CONSTRAINT "_documents_v_version_province_id_provinces_id_fk" FOREIGN KEY ("version_province_id") REFERENCES "public"."provinces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_documents_v" ADD CONSTRAINT "_documents_v_version_type_id_document_types_id_fk" FOREIGN KEY ("version_type_id") REFERENCES "public"."document_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_documents_v" ADD CONSTRAINT "_documents_v_version_topic_id_topics_id_fk" FOREIGN KEY ("version_topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_documents_v_rels" ADD CONSTRAINT "_documents_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_documents_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_documents_v_rels" ADD CONSTRAINT "_documents_v_rels_files_fk" FOREIGN KEY ("files_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_thumbnail_id_files_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "dashboards_rels" ADD CONSTRAINT "dashboards_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."dashboards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "dashboards_rels" ADD CONSTRAINT "dashboards_rels_files_fk" FOREIGN KEY ("files_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_dashboards_v" ADD CONSTRAINT "_dashboards_v_parent_id_dashboards_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."dashboards"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_dashboards_v" ADD CONSTRAINT "_dashboards_v_version_province_id_provinces_id_fk" FOREIGN KEY ("version_province_id") REFERENCES "public"."provinces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_dashboards_v" ADD CONSTRAINT "_dashboards_v_version_topic_id_topics_id_fk" FOREIGN KEY ("version_topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_dashboards_v" ADD CONSTRAINT "_dashboards_v_version_thumbnail_id_files_id_fk" FOREIGN KEY ("version_thumbnail_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_dashboards_v_rels" ADD CONSTRAINT "_dashboards_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_dashboards_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_dashboards_v_rels" ADD CONSTRAINT "_dashboards_v_rels_files_fk" FOREIGN KEY ("files_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "files" ADD CONSTRAINT "files_version_of_id_files_id_fk" FOREIGN KEY ("version_of_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "central_contents_links" ADD CONSTRAINT "central_contents_links_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "central_contents_links" ADD CONSTRAINT "central_contents_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."central_contents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "central_contents_rels" ADD CONSTRAINT "central_contents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."central_contents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "central_contents_rels" ADD CONSTRAINT "central_contents_rels_files_fk" FOREIGN KEY ("files_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "announcements" ADD CONSTRAINT "announcements_image_id_files_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "announcements_rels" ADD CONSTRAINT "announcements_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "announcements_rels" ADD CONSTRAINT "announcements_rels_provinces_fk" FOREIGN KEY ("provinces_id") REFERENCES "public"."provinces"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_announcements_v" ADD CONSTRAINT "_announcements_v_parent_id_announcements_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."announcements"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_announcements_v" ADD CONSTRAINT "_announcements_v_version_image_id_files_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_announcements_v_rels" ADD CONSTRAINT "_announcements_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_announcements_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_announcements_v_rels" ADD CONSTRAINT "_announcements_v_rels_provinces_fk" FOREIGN KEY ("provinces_id") REFERENCES "public"."provinces"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "provinces" ADD CONSTRAINT "provinces_hero_image_id_files_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_recovery_codes" ADD CONSTRAINT "users_recovery_codes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_provinces_fk" FOREIGN KEY ("provinces_id") REFERENCES "public"."provinces"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "page_views" ADD CONSTRAINT "page_views_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_dashboards_fk" FOREIGN KEY ("dashboards_id") REFERENCES "public"."dashboards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_files_fk" FOREIGN KEY ("files_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_central_contents_fk" FOREIGN KEY ("central_contents_id") REFERENCES "public"."central_contents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_announcements_fk" FOREIGN KEY ("announcements_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_provinces_fk" FOREIGN KEY ("provinces_id") REFERENCES "public"."provinces"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_document_types_fk" FOREIGN KEY ("document_types_id") REFERENCES "public"."document_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_user_tokens_fk" FOREIGN KEY ("user_tokens_id") REFERENCES "public"."user_tokens"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_page_views_fk" FOREIGN KEY ("page_views_id") REFERENCES "public"."page_views"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cookie_consents_fk" FOREIGN KEY ("cookie_consents_id") REFERENCES "public"."cookie_consents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_footer_links" ADD CONSTRAINT "site_settings_footer_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "documents_province_idx" ON "documents" USING btree ("province_id");
  CREATE INDEX "documents_fiscal_year_idx" ON "documents" USING btree ("fiscal_year");
  CREATE INDEX "documents_type_idx" ON "documents" USING btree ("type_id");
  CREATE INDEX "documents_topic_idx" ON "documents" USING btree ("topic_id");
  CREATE UNIQUE INDEX "documents_legacy_id_idx" ON "documents" USING btree ("legacy_id");
  CREATE INDEX "documents_needs_review_idx" ON "documents" USING btree ("needs_review");
  CREATE INDEX "documents_updated_at_idx" ON "documents" USING btree ("updated_at");
  CREATE INDEX "documents_created_at_idx" ON "documents" USING btree ("created_at");
  CREATE INDEX "documents_deleted_at_idx" ON "documents" USING btree ("deleted_at");
  CREATE INDEX "documents__status_idx" ON "documents" USING btree ("_status");
  CREATE INDEX "documents_rels_order_idx" ON "documents_rels" USING btree ("order");
  CREATE INDEX "documents_rels_parent_idx" ON "documents_rels" USING btree ("parent_id");
  CREATE INDEX "documents_rels_path_idx" ON "documents_rels" USING btree ("path");
  CREATE INDEX "documents_rels_files_id_idx" ON "documents_rels" USING btree ("files_id");
  CREATE INDEX "_documents_v_parent_idx" ON "_documents_v" USING btree ("parent_id");
  CREATE INDEX "_documents_v_version_version_province_idx" ON "_documents_v" USING btree ("version_province_id");
  CREATE INDEX "_documents_v_version_version_fiscal_year_idx" ON "_documents_v" USING btree ("version_fiscal_year");
  CREATE INDEX "_documents_v_version_version_type_idx" ON "_documents_v" USING btree ("version_type_id");
  CREATE INDEX "_documents_v_version_version_topic_idx" ON "_documents_v" USING btree ("version_topic_id");
  CREATE INDEX "_documents_v_version_version_legacy_id_idx" ON "_documents_v" USING btree ("version_legacy_id");
  CREATE INDEX "_documents_v_version_version_needs_review_idx" ON "_documents_v" USING btree ("version_needs_review");
  CREATE INDEX "_documents_v_version_version_updated_at_idx" ON "_documents_v" USING btree ("version_updated_at");
  CREATE INDEX "_documents_v_version_version_created_at_idx" ON "_documents_v" USING btree ("version_created_at");
  CREATE INDEX "_documents_v_version_version_deleted_at_idx" ON "_documents_v" USING btree ("version_deleted_at");
  CREATE INDEX "_documents_v_version_version__status_idx" ON "_documents_v" USING btree ("version__status");
  CREATE INDEX "_documents_v_created_at_idx" ON "_documents_v" USING btree ("created_at");
  CREATE INDEX "_documents_v_updated_at_idx" ON "_documents_v" USING btree ("updated_at");
  CREATE INDEX "_documents_v_latest_idx" ON "_documents_v" USING btree ("latest");
  CREATE INDEX "_documents_v_rels_order_idx" ON "_documents_v_rels" USING btree ("order");
  CREATE INDEX "_documents_v_rels_parent_idx" ON "_documents_v_rels" USING btree ("parent_id");
  CREATE INDEX "_documents_v_rels_path_idx" ON "_documents_v_rels" USING btree ("path");
  CREATE INDEX "_documents_v_rels_files_id_idx" ON "_documents_v_rels" USING btree ("files_id");
  CREATE INDEX "dashboards_province_idx" ON "dashboards" USING btree ("province_id");
  CREATE INDEX "dashboards_fiscal_year_idx" ON "dashboards" USING btree ("fiscal_year");
  CREATE INDEX "dashboards_topic_idx" ON "dashboards" USING btree ("topic_id");
  CREATE INDEX "dashboards_thumbnail_idx" ON "dashboards" USING btree ("thumbnail_id");
  CREATE UNIQUE INDEX "dashboards_legacy_id_idx" ON "dashboards" USING btree ("legacy_id");
  CREATE INDEX "dashboards_needs_review_idx" ON "dashboards" USING btree ("needs_review");
  CREATE INDEX "dashboards_updated_at_idx" ON "dashboards" USING btree ("updated_at");
  CREATE INDEX "dashboards_created_at_idx" ON "dashboards" USING btree ("created_at");
  CREATE INDEX "dashboards_deleted_at_idx" ON "dashboards" USING btree ("deleted_at");
  CREATE INDEX "dashboards__status_idx" ON "dashboards" USING btree ("_status");
  CREATE INDEX "dashboards_rels_order_idx" ON "dashboards_rels" USING btree ("order");
  CREATE INDEX "dashboards_rels_parent_idx" ON "dashboards_rels" USING btree ("parent_id");
  CREATE INDEX "dashboards_rels_path_idx" ON "dashboards_rels" USING btree ("path");
  CREATE INDEX "dashboards_rels_files_id_idx" ON "dashboards_rels" USING btree ("files_id");
  CREATE INDEX "_dashboards_v_parent_idx" ON "_dashboards_v" USING btree ("parent_id");
  CREATE INDEX "_dashboards_v_version_version_province_idx" ON "_dashboards_v" USING btree ("version_province_id");
  CREATE INDEX "_dashboards_v_version_version_fiscal_year_idx" ON "_dashboards_v" USING btree ("version_fiscal_year");
  CREATE INDEX "_dashboards_v_version_version_topic_idx" ON "_dashboards_v" USING btree ("version_topic_id");
  CREATE INDEX "_dashboards_v_version_version_thumbnail_idx" ON "_dashboards_v" USING btree ("version_thumbnail_id");
  CREATE INDEX "_dashboards_v_version_version_legacy_id_idx" ON "_dashboards_v" USING btree ("version_legacy_id");
  CREATE INDEX "_dashboards_v_version_version_needs_review_idx" ON "_dashboards_v" USING btree ("version_needs_review");
  CREATE INDEX "_dashboards_v_version_version_updated_at_idx" ON "_dashboards_v" USING btree ("version_updated_at");
  CREATE INDEX "_dashboards_v_version_version_created_at_idx" ON "_dashboards_v" USING btree ("version_created_at");
  CREATE INDEX "_dashboards_v_version_version_deleted_at_idx" ON "_dashboards_v" USING btree ("version_deleted_at");
  CREATE INDEX "_dashboards_v_version_version__status_idx" ON "_dashboards_v" USING btree ("version__status");
  CREATE INDEX "_dashboards_v_created_at_idx" ON "_dashboards_v" USING btree ("created_at");
  CREATE INDEX "_dashboards_v_updated_at_idx" ON "_dashboards_v" USING btree ("updated_at");
  CREATE INDEX "_dashboards_v_latest_idx" ON "_dashboards_v" USING btree ("latest");
  CREATE INDEX "_dashboards_v_rels_order_idx" ON "_dashboards_v_rels" USING btree ("order");
  CREATE INDEX "_dashboards_v_rels_parent_idx" ON "_dashboards_v_rels" USING btree ("parent_id");
  CREATE INDEX "_dashboards_v_rels_path_idx" ON "_dashboards_v_rels" USING btree ("path");
  CREATE INDEX "_dashboards_v_rels_files_id_idx" ON "_dashboards_v_rels" USING btree ("files_id");
  CREATE INDEX "files_public_path_idx" ON "files" USING btree ("public_path");
  CREATE UNIQUE INDEX "files_legacy_url_idx" ON "files" USING btree ("legacy_url");
  CREATE INDEX "files_is_current_idx" ON "files" USING btree ("is_current");
  CREATE INDEX "files_version_of_idx" ON "files" USING btree ("version_of_id");
  CREATE INDEX "files_uploaded_by_idx" ON "files" USING btree ("uploaded_by_id");
  CREATE INDEX "files_updated_at_idx" ON "files" USING btree ("updated_at");
  CREATE INDEX "files_created_at_idx" ON "files" USING btree ("created_at");
  CREATE UNIQUE INDEX "files_filename_idx" ON "files" USING btree ("filename");
  CREATE INDEX "central_contents_links_order_idx" ON "central_contents_links" USING btree ("_order");
  CREATE INDEX "central_contents_links_parent_id_idx" ON "central_contents_links" USING btree ("_parent_id");
  CREATE INDEX "central_contents_links_file_idx" ON "central_contents_links" USING btree ("file_id");
  CREATE INDEX "central_contents_updated_at_idx" ON "central_contents" USING btree ("updated_at");
  CREATE INDEX "central_contents_created_at_idx" ON "central_contents" USING btree ("created_at");
  CREATE INDEX "central_contents_rels_order_idx" ON "central_contents_rels" USING btree ("order");
  CREATE INDEX "central_contents_rels_parent_idx" ON "central_contents_rels" USING btree ("parent_id");
  CREATE INDEX "central_contents_rels_path_idx" ON "central_contents_rels" USING btree ("path");
  CREATE INDEX "central_contents_rels_files_id_idx" ON "central_contents_rels" USING btree ("files_id");
  CREATE INDEX "announcements_image_idx" ON "announcements" USING btree ("image_id");
  CREATE INDEX "announcements_updated_at_idx" ON "announcements" USING btree ("updated_at");
  CREATE INDEX "announcements_created_at_idx" ON "announcements" USING btree ("created_at");
  CREATE INDEX "announcements__status_idx" ON "announcements" USING btree ("_status");
  CREATE INDEX "announcements_rels_order_idx" ON "announcements_rels" USING btree ("order");
  CREATE INDEX "announcements_rels_parent_idx" ON "announcements_rels" USING btree ("parent_id");
  CREATE INDEX "announcements_rels_path_idx" ON "announcements_rels" USING btree ("path");
  CREATE INDEX "announcements_rels_provinces_id_idx" ON "announcements_rels" USING btree ("provinces_id");
  CREATE INDEX "_announcements_v_parent_idx" ON "_announcements_v" USING btree ("parent_id");
  CREATE INDEX "_announcements_v_version_version_image_idx" ON "_announcements_v" USING btree ("version_image_id");
  CREATE INDEX "_announcements_v_version_version_updated_at_idx" ON "_announcements_v" USING btree ("version_updated_at");
  CREATE INDEX "_announcements_v_version_version_created_at_idx" ON "_announcements_v" USING btree ("version_created_at");
  CREATE INDEX "_announcements_v_version_version__status_idx" ON "_announcements_v" USING btree ("version__status");
  CREATE INDEX "_announcements_v_created_at_idx" ON "_announcements_v" USING btree ("created_at");
  CREATE INDEX "_announcements_v_updated_at_idx" ON "_announcements_v" USING btree ("updated_at");
  CREATE INDEX "_announcements_v_latest_idx" ON "_announcements_v" USING btree ("latest");
  CREATE INDEX "_announcements_v_rels_order_idx" ON "_announcements_v_rels" USING btree ("order");
  CREATE INDEX "_announcements_v_rels_parent_idx" ON "_announcements_v_rels" USING btree ("parent_id");
  CREATE INDEX "_announcements_v_rels_path_idx" ON "_announcements_v_rels" USING btree ("path");
  CREATE INDEX "_announcements_v_rels_provinces_id_idx" ON "_announcements_v_rels" USING btree ("provinces_id");
  CREATE UNIQUE INDEX "provinces_slug_idx" ON "provinces" USING btree ("slug");
  CREATE UNIQUE INDEX "provinces_code_idx" ON "provinces" USING btree ("code");
  CREATE INDEX "provinces_hero_image_idx" ON "provinces" USING btree ("hero_image_id");
  CREATE INDEX "provinces_updated_at_idx" ON "provinces" USING btree ("updated_at");
  CREATE INDEX "provinces_created_at_idx" ON "provinces" USING btree ("created_at");
  CREATE UNIQUE INDEX "topics_slug_idx" ON "topics" USING btree ("slug");
  CREATE INDEX "topics_updated_at_idx" ON "topics" USING btree ("updated_at");
  CREATE INDEX "topics_created_at_idx" ON "topics" USING btree ("created_at");
  CREATE UNIQUE INDEX "document_types_code_idx" ON "document_types" USING btree ("code");
  CREATE INDEX "document_types_updated_at_idx" ON "document_types" USING btree ("updated_at");
  CREATE INDEX "document_types_created_at_idx" ON "document_types" USING btree ("created_at");
  CREATE INDEX "users_recovery_codes_order_idx" ON "users_recovery_codes" USING btree ("_order");
  CREATE INDEX "users_recovery_codes_parent_id_idx" ON "users_recovery_codes" USING btree ("_parent_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_status_idx" ON "users" USING btree ("status");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");
  CREATE INDEX "users_rels_order_idx" ON "users_rels" USING btree ("order");
  CREATE INDEX "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id");
  CREATE INDEX "users_rels_path_idx" ON "users_rels" USING btree ("path");
  CREATE INDEX "users_rels_provinces_id_idx" ON "users_rels" USING btree ("provinces_id");
  CREATE INDEX "user_tokens_user_idx" ON "user_tokens" USING btree ("user_id");
  CREATE UNIQUE INDEX "user_tokens_token_hash_idx" ON "user_tokens" USING btree ("token_hash");
  CREATE INDEX "user_tokens_created_by_idx" ON "user_tokens" USING btree ("created_by_id");
  CREATE INDEX "user_tokens_updated_at_idx" ON "user_tokens" USING btree ("updated_at");
  CREATE INDEX "user_tokens_created_at_idx" ON "user_tokens" USING btree ("created_at");
  CREATE INDEX "page_views_province_idx" ON "page_views" USING btree ("province_id");
  CREATE INDEX "page_views_day_idx" ON "page_views" USING btree ("day");
  CREATE INDEX "page_views_updated_at_idx" ON "page_views" USING btree ("updated_at");
  CREATE INDEX "page_views_created_at_idx" ON "page_views" USING btree ("created_at");
  CREATE UNIQUE INDEX "province_day_page_idx" ON "page_views" USING btree ("province_id","day","page");
  CREATE INDEX "cookie_consents_visitor_id_idx" ON "cookie_consents" USING btree ("visitor_id");
  CREATE INDEX "cookie_consents_updated_at_idx" ON "cookie_consents" USING btree ("updated_at");
  CREATE INDEX "cookie_consents_created_at_idx" ON "cookie_consents" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_documents_id_idx" ON "payload_locked_documents_rels" USING btree ("documents_id");
  CREATE INDEX "payload_locked_documents_rels_dashboards_id_idx" ON "payload_locked_documents_rels" USING btree ("dashboards_id");
  CREATE INDEX "payload_locked_documents_rels_files_id_idx" ON "payload_locked_documents_rels" USING btree ("files_id");
  CREATE INDEX "payload_locked_documents_rels_central_contents_id_idx" ON "payload_locked_documents_rels" USING btree ("central_contents_id");
  CREATE INDEX "payload_locked_documents_rels_announcements_id_idx" ON "payload_locked_documents_rels" USING btree ("announcements_id");
  CREATE INDEX "payload_locked_documents_rels_provinces_id_idx" ON "payload_locked_documents_rels" USING btree ("provinces_id");
  CREATE INDEX "payload_locked_documents_rels_topics_id_idx" ON "payload_locked_documents_rels" USING btree ("topics_id");
  CREATE INDEX "payload_locked_documents_rels_document_types_id_idx" ON "payload_locked_documents_rels" USING btree ("document_types_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_user_tokens_id_idx" ON "payload_locked_documents_rels" USING btree ("user_tokens_id");
  CREATE INDEX "payload_locked_documents_rels_page_views_id_idx" ON "payload_locked_documents_rels" USING btree ("page_views_id");
  CREATE INDEX "payload_locked_documents_rels_cookie_consents_id_idx" ON "payload_locked_documents_rels" USING btree ("cookie_consents_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "site_settings_footer_links_order_idx" ON "site_settings_footer_links" USING btree ("_order");
  CREATE INDEX "site_settings_footer_links_parent_id_idx" ON "site_settings_footer_links" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "documents" CASCADE;
  DROP TABLE "documents_rels" CASCADE;
  DROP TABLE "_documents_v" CASCADE;
  DROP TABLE "_documents_v_rels" CASCADE;
  DROP TABLE "dashboards" CASCADE;
  DROP TABLE "dashboards_rels" CASCADE;
  DROP TABLE "_dashboards_v" CASCADE;
  DROP TABLE "_dashboards_v_rels" CASCADE;
  DROP TABLE "files" CASCADE;
  DROP TABLE "central_contents_links" CASCADE;
  DROP TABLE "central_contents" CASCADE;
  DROP TABLE "central_contents_rels" CASCADE;
  DROP TABLE "announcements" CASCADE;
  DROP TABLE "announcements_rels" CASCADE;
  DROP TABLE "_announcements_v" CASCADE;
  DROP TABLE "_announcements_v_rels" CASCADE;
  DROP TABLE "provinces" CASCADE;
  DROP TABLE "topics" CASCADE;
  DROP TABLE "document_types" CASCADE;
  DROP TABLE "users_recovery_codes" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "users_rels" CASCADE;
  DROP TABLE "user_tokens" CASCADE;
  DROP TABLE "page_views" CASCADE;
  DROP TABLE "cookie_consents" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "site_settings_footer_links" CASCADE;
  DROP TABLE "site_settings" CASCADE;
  DROP TYPE "public"."enum_documents_status";
  DROP TYPE "public"."enum__documents_v_version_status";
  DROP TYPE "public"."enum_dashboards_provider";
  DROP TYPE "public"."enum_dashboards_status";
  DROP TYPE "public"."enum__dashboards_v_version_provider";
  DROP TYPE "public"."enum__dashboards_v_version_status";
  DROP TYPE "public"."enum_central_contents_section";
  DROP TYPE "public"."enum_announcements_show_on";
  DROP TYPE "public"."enum_announcements_frequency";
  DROP TYPE "public"."enum_announcements_status";
  DROP TYPE "public"."enum__announcements_v_version_show_on";
  DROP TYPE "public"."enum__announcements_v_version_frequency";
  DROP TYPE "public"."enum__announcements_v_version_status";
  DROP TYPE "public"."enum_provinces_theme";
  DROP TYPE "public"."enum_provinces_hero_text_side";
  DROP TYPE "public"."enum_document_types_group";
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_users_status";
  DROP TYPE "public"."enum_user_tokens_purpose";
  DROP TYPE "public"."enum_page_views_page";
  DROP TYPE "public"."enum_site_settings_mourning_ribbon_corner";`)
}
