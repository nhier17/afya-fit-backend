ALTER TABLE "products" ADD COLUMN "stock_quantity" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "is_voided" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "voided_at" timestamp;