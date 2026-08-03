ALTER TABLE "sales" DROP CONSTRAINT "sales_sold_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "recorded_by" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_sold_by_user_id_fk" FOREIGN KEY ("sold_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;