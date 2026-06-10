ALTER TABLE "campaigns" ADD COLUMN "system" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "attendees" jsonb DEFAULT '[]'::jsonb NOT NULL;