ALTER TABLE "invitations" ADD COLUMN "revoked_at" timestamp;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "last_sent_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_active_scope_email_role_unique" ON "invitations" USING btree ("workspace_id","campaign_id","normalized_email","campaign_role") WHERE "invitations"."status" = 'pending';