ALTER TABLE "campaigns" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "creation_request_key" uuid;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_created_by_user_id_creation_request_key_unique" UNIQUE("workspace_id","created_by_user_id","creation_request_key");