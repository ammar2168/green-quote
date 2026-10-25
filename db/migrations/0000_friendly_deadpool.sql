CREATE TYPE "public"."risk_band" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"address" text NOT NULL,
	"monthly_consumption_kwh" numeric(10, 2) NOT NULL,
	"system_size_kw" numeric(8, 2) NOT NULL,
	"down_payment" numeric(12, 2) DEFAULT 0 NOT NULL,
	"system_price" numeric(12, 2) NOT NULL,
	"principal" numeric(12, 2) NOT NULL,
	"risk_band" "risk_band" NOT NULL,
	"apr" numeric(5, 2) NOT NULL,
	"offers" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_monthly_consumption_kwh_positive" CHECK ("quotes"."monthly_consumption_kwh" > 0),
	CONSTRAINT "quotes_system_size_kw_positive" CHECK ("quotes"."system_size_kw" > 0),
	CONSTRAINT "quotes_down_payment_non_negative" CHECK ("quotes"."down_payment" >= 0),
	CONSTRAINT "quotes_principal_matches_price" CHECK ("quotes"."principal" = "quotes"."system_price" - "quotes"."down_payment")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quotes_user_id_created_at_idx" ON "quotes" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "quotes_email_idx" ON "quotes" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));