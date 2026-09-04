CREATE TABLE "auth_email_rate_limit_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_email_rate_limit_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"subject_key" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_email_rate_limit_subjects_scope_subject_key_unique" UNIQUE("scope","subject_key"),
	CONSTRAINT "auth_email_rate_limit_subjects_scope_check" CHECK ("auth_email_rate_limit_subjects"."scope" in ('verification', 'recovery_email', 'recovery_ip'))
);
--> statement-breakpoint
ALTER TABLE "auth_email_rate_limit_attempts" ADD CONSTRAINT "auth_email_rate_limit_attempts_subject_id_auth_email_rate_limit_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."auth_email_rate_limit_subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_email_rate_limit_attempts_subject_occurred_at_idx" ON "auth_email_rate_limit_attempts" USING btree ("subject_id","occurred_at");--> statement-breakpoint
CREATE INDEX "auth_email_rate_limit_attempts_expires_at_idx" ON "auth_email_rate_limit_attempts" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_email_rate_limit_subjects_expires_at_idx" ON "auth_email_rate_limit_subjects" USING btree ("expires_at");