-- Existing parent links are preserved. Rollback requires assigning any newly standalone rows to an Arc in their campaign first.
ALTER TABLE "milestones" ALTER COLUMN "arc_id" DROP NOT NULL;
