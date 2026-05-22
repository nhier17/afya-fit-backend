CREATE TABLE "daily_members" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "daily_members_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"gender" "gender" NOT NULL,
	"phone" varchar(20) NOT NULL,
	"package_id" integer NOT NULL,
	"amount_paid" numeric(10, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"payment_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_members" ADD CONSTRAINT "daily_members_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_members_phone_idx" ON "daily_members" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "daily_members_payment_date_idx" ON "daily_members" USING btree ("payment_date");