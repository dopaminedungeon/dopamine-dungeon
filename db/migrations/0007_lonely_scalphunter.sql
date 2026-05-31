CREATE TABLE "entity_links" (
	"row_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"id" text NOT NULL,
	"entity_a_type" text NOT NULL,
	"entity_a_id" text NOT NULL,
	"entity_b_type" text NOT NULL,
	"entity_b_id" text NOT NULL,
	"label" text NOT NULL,
	"visibility" text NOT NULL,
	"created_in_session" text,
	"note" text,
	"created_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "entity_links_campaign_id_id_unique" UNIQUE("campaign_id","id"),
	CONSTRAINT "entity_links_campaign_id_entity_a_type_entity_a_id_entity_b_type_entity_b_id_label_visibility_unique" UNIQUE("campaign_id","entity_a_type","entity_a_id","entity_b_type","entity_b_id","label","visibility")
);
--> statement-breakpoint
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;