CREATE TABLE "invitation_character_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"character_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_character_assignments_invitation_id_character_id_unique" UNIQUE("invitation_id","character_id")
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "invitation_character_assignments" ADD CONSTRAINT "invitation_character_assignments_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE no action ON UPDATE no action;