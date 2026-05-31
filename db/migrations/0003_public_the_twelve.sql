CREATE TABLE "sessions" (
	"row_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"id" text NOT NULL,
	"session_number" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"players" integer DEFAULT 0 NOT NULL,
	"max_players" integer DEFAULT 0 NOT NULL,
	"duration" text DEFAULT '—' NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"start_time" text DEFAULT '' NOT NULL,
	"map" text DEFAULT '' NOT NULL,
	"difficulty" text DEFAULT 'Normal' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"timeline" text DEFAULT '' NOT NULL,
	"moments" text DEFAULT '' NOT NULL,
	"quotes" text DEFAULT '' NOT NULL,
	"gm_notes" text DEFAULT '' NOT NULL,
	"gm_secrets" text DEFAULT '' NOT NULL,
	"gm_prep" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_campaign_id_id_unique" UNIQUE("campaign_id","id")
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;