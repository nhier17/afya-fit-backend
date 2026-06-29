CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"type" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sale_items" RENAME COLUMN "price" TO "unit_price";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sku" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "cost_price" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "discount_amount" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "stock_quantity";--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_sku_unique" UNIQUE("sku");