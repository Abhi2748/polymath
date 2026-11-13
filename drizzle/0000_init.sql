CREATE TYPE "public"."topic_state" AS ENUM('new', 'in_progress', 'learned', 'recalled', 'explained', 'connected');--> statement-breakpoint
CREATE TABLE "edges" (
	"a" text NOT NULL,
	"b" text NOT NULL,
	"why" text NOT NULL,
	CONSTRAINT "edges_a_b_pk" PRIMARY KEY("a","b")
);
--> statement-breakpoint
CREATE TABLE "fields" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"realm" text NOT NULL,
	"kind" text NOT NULL,
	"season" integer,
	"lens" text NOT NULL,
	"level2" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flags" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "flags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"topic_id" text NOT NULL,
	"ref" text NOT NULL,
	"note" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_history" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "item_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"topic_id" text NOT NULL,
	"item_id" text NOT NULL,
	"asked_at" timestamp with time zone NOT NULL,
	"grade" text NOT NULL,
	"context" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"topic_id" text PRIMARY KEY NOT NULL,
	"pack" jsonb NOT NULL,
	"status" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"session_day" date NOT NULL,
	"kind" text NOT NULL,
	"mode" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"summary" jsonb,
	CONSTRAINT "sessions_user_id_session_day_kind_unique" UNIQUE("user_id","session_day","kind")
);
--> statement-breakpoint
CREATE TABLE "topic_prereqs" (
	"topic_id" text NOT NULL,
	"prereq_id" text NOT NULL,
	CONSTRAINT "topic_prereqs_topic_id_prereq_id_pk" PRIMARY KEY("topic_id","prereq_id")
);
--> statement-breakpoint
CREATE TABLE "topic_progress" (
	"user_id" uuid NOT NULL,
	"topic_id" text NOT NULL,
	"state" "topic_state" DEFAULT 'new' NOT NULL,
	"card_index" integer DEFAULT 0 NOT NULL,
	"learned_at" timestamp with time zone,
	"box" integer,
	"due_at" date,
	"last_reviewed_at" timestamp with time zone,
	"success_streak" integer DEFAULT 0 NOT NULL,
	"fail_streak" integer DEFAULT 0 NOT NULL,
	"lapsed" boolean DEFAULT false NOT NULL,
	"parked" boolean DEFAULT false NOT NULL,
	CONSTRAINT "topic_progress_user_id_topic_id_pk" PRIMARY KEY("user_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" text PRIMARY KEY NOT NULL,
	"field_code" text NOT NULL,
	"level" integer NOT NULL,
	"season" integer NOT NULL,
	"seq" integer NOT NULL,
	"title" text NOT NULL,
	"question" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"tz" text NOT NULL,
	"session_minutes" integer DEFAULT 30 NOT NULL,
	"max_new_per_day" integer DEFAULT 2 NOT NULL,
	"fields_off" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"planned_return" date
);
--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_a_topics_id_fk" FOREIGN KEY ("a") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_b_topics_id_fk" FOREIGN KEY ("b") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_history" ADD CONSTRAINT "item_history_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_prereqs" ADD CONSTRAINT "topic_prereqs_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_prereqs" ADD CONSTRAINT "topic_prereqs_prereq_id_topics_id_fk" FOREIGN KEY ("prereq_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_progress" ADD CONSTRAINT "topic_progress_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_field_code_fields_code_fk" FOREIGN KEY ("field_code") REFERENCES "public"."fields"("code") ON DELETE no action ON UPDATE no action;