ALTER TABLE "auth_email_rate_limit_attempts" ALTER COLUMN "occurred_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_email_rate_limit_attempts" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_email_rate_limit_subjects" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_email_rate_limit_subjects" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_email_rate_limit_subjects" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "auth_email_rate_limit_subjects" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_email_rate_limit_subjects" ALTER COLUMN "updated_at" SET DEFAULT now();