CREATE TABLE "arcs" (
	"row_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"id" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"visibility" text DEFAULT 'gm-only' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "arcs_campaign_id_id_unique" UNIQUE("campaign_id","id")
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"row_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"id" text NOT NULL,
	"arc_id" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"visibility" text DEFAULT 'gm-only' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "milestones_campaign_id_id_unique" UNIQUE("campaign_id","id")
);
--> statement-breakpoint
ALTER TABLE "arcs" ADD CONSTRAINT "arcs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_campaign_id_arc_id_arcs_campaign_id_id_fk" FOREIGN KEY ("campaign_id","arc_id") REFERENCES "public"."arcs"("campaign_id","id") ON DELETE cascade ON UPDATE no action;