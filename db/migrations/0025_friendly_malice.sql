CREATE TABLE "quests" (
	"row_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"visibility" text NOT NULL,
	"start_session_id" text DEFAULT '' NOT NULL,
	"end_session_id" text DEFAULT '' NOT NULL,
	"end_date" text DEFAULT '' NOT NULL,
	"giver_id" text DEFAULT '' NOT NULL,
	"receiver_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"short_description" text DEFAULT '' NOT NULL,
	"hook" text DEFAULT '' NOT NULL,
	"journey" text DEFAULT '' NOT NULL,
	"aftermath" text DEFAULT '' NOT NULL,
	"section_visibility" jsonb NOT NULL,
	"main_objectives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"secondary_objectives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quests_campaign_id_id_unique" UNIQUE("campaign_id","id")
);
--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;