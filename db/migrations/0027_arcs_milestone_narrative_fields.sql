ALTER TABLE "arcs" ADD COLUMN "type" text DEFAULT 'main_story' NOT NULL;--> statement-breakpoint
UPDATE "arcs" SET "type" = 'main_story';--> statement-breakpoint
ALTER TABLE "arcs" ADD COLUMN "progress" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "arcs" ADD COLUMN "plot_hook" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "arcs" ADD COLUMN "grim_portents_frontiers" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "arcs" ADD COLUMN "arc_structure" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "arcs" ADD COLUMN "climax_conditions" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "arcs" ADD COLUMN "resolution_fallout" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "conditions_for_level_up" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "intended_level_progression" text DEFAULT '' NOT NULL;
