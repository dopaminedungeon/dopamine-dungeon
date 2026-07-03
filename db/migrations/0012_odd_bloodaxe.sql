CREATE TABLE "lore" (
	"row_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"id" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'Lore' NOT NULL,
	"visibility" text DEFAULT 'gm-only' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"gm_notes" text DEFAULT '' NOT NULL,
	"aliases" jsonb NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lore_campaign_id_id_unique" UNIQUE("campaign_id","id")
);
--> statement-breakpoint
ALTER TABLE "lore" ADD CONSTRAINT "lore_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;