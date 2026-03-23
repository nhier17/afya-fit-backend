CREATE TYPE "public"."checkin_method" AS ENUM('fingerprint', 'manual');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."member_type" AS ENUM('normal', 'gym offer');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'expired', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."package_category" AS ENUM('normal', 'offer');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'm-pesa', 'paybill', 'cheque');--> statement-breakpoint
CREATE TYPE "public"."sms_purpose" AS ENUM('welcome', 'reminder', 'payment', 'general');--> statement-breakpoint
CREATE TYPE "public"."sms_status" AS ENUM('queued', 'sent', 'delivered', 'failed');--> statement-breakpoint
CREATE TABLE "checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"method" "checkin_method" NOT NULL,
	"checkin_time" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"category" text,
	"amount" numeric(10, 2) NOT NULL,
	"payment_method" "payment_method",
	"expense_date" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"gender" "gender" NOT NULL,
	"member_type" "member_type" NOT NULL,
	"phone" varchar(20) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "members_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"registration_fee" numeric(10, 2) DEFAULT '0',
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" "package_category" NOT NULL,
	"duration_in_days" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"transaction_reference" varchar(255),
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"buying_price" numeric(10, 2),
	"selling_price" numeric(10, 2) NOT NULL,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"low_stock_alert" integer DEFAULT 5,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"permissions" jsonb NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"sold_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid,
	"phone" varchar(20) NOT NULL,
	"message" text NOT NULL,
	"purpose" "sms_purpose" NOT NULL,
	"status" "sms_status" DEFAULT 'queued',
	"provider" text,
	"provider_message_id" text,
	"error_message" text,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" varchar(150) NOT NULL,
	"password_hash" text NOT NULL,
	"role_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "checkin_member_idx" ON "checkins" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "members_phone_idx" ON "members" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "membership_member_idx" ON "memberships" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "membership_end_date_idx" ON "memberships" USING btree ("end_date");