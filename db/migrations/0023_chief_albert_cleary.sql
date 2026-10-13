-- Linked entries previously stored a forced zero despite having no worth field.
-- Loose-entry zeros are preserved because missing and explicit zero were historically indistinguishable.
-- Rollback: set NULL worth_gp values to 0, restore DEFAULT 0 and NOT NULL. This loses the new missing/zero distinction.
ALTER TABLE "bag_entries" ALTER COLUMN "worth_gp" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "bag_entries" ALTER COLUMN "worth_gp" DROP NOT NULL;--> statement-breakpoint
UPDATE "bag_entries" SET "worth_gp" = NULL WHERE "source_type" = 'linked' AND "worth_gp" = 0;
