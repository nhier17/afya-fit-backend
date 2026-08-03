ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_created_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "sales" DROP CONSTRAINT "sales_sold_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_sold_by_user_id_fk" FOREIGN KEY ("sold_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;