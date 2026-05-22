ALTER TABLE "payments" ADD COLUMN "receipt_number" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "recorded_by" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_receipt_number_unique" UNIQUE("receipt_number");