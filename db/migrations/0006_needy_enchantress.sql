CREATE TABLE "bag_currency" (
	"campaign_id" uuid PRIMARY KEY NOT NULL,
	"cp" integer DEFAULT 0 NOT NULL,
	"sp" integer DEFAULT 0 NOT NULL,
	"ep" integer DEFAULT 0 NOT NULL,
	"gp" integer DEFAULT 0 NOT NULL,
	"pp" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bag_entries" (
	"row_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"id" text NOT NULL,
	"source_type" text NOT NULL,
	"item_id" text,
	"name" text DEFAULT '' NOT NULL,
	"category" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"worth_gp" double precision DEFAULT 0 NOT NULL,
	"notes" text,
	"added_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bag_entries_campaign_id_id_unique" UNIQUE("campaign_id","id")
);
--> statement-breakpoint
ALTER TABLE "bag_currency" ADD CONSTRAINT "bag_currency_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bag_entries" ADD CONSTRAINT "bag_entries_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;