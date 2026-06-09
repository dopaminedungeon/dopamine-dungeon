CREATE TABLE "character_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"character_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "character_assignments_campaign_id_character_id_unique" UNIQUE("campaign_id","character_id"),
	CONSTRAINT "character_assignments_campaign_id_user_id_character_id_unique" UNIQUE("campaign_id","user_id","character_id")
);
--> statement-breakpoint
ALTER TABLE "character_assignments" ADD CONSTRAINT "character_assignments_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_assignments" ADD CONSTRAINT "character_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_assignments" ADD CONSTRAINT "character_assignments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;