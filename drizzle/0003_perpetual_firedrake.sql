ALTER TABLE "expenses" ALTER COLUMN "created_by" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "created_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_movements" ALTER COLUMN "created_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "recorded_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "sold_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;