CREATE TABLE "npcs" (
	"row_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"id" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'NPC' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"gm_notes" text DEFAULT '' NOT NULL,
	"image_url" text DEFAULT '' NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "npcs_campaign_id_id_unique" UNIQUE("campaign_id","id")
);
--> statement-breakpoint
ALTER TABLE "npcs" ADD CONSTRAINT "npcs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;