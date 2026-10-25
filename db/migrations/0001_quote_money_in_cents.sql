ALTER TABLE "quotes" RENAME COLUMN "down_payment" TO "down_payment_cents";--> statement-breakpoint
ALTER TABLE "quotes" RENAME COLUMN "system_price" TO "system_price_cents";--> statement-breakpoint
ALTER TABLE "quotes" RENAME COLUMN "principal" TO "principal_cents";--> statement-breakpoint
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_down_payment_non_negative";--> statement-breakpoint
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_principal_matches_price";--> statement-breakpoint
-- Hand-written: drizzle-kit renames these columns but omits the type change.
-- USING converts any existing dollar amounts to cents rather than truncating them.
ALTER TABLE "quotes" ALTER COLUMN "down_payment_cents" SET DATA TYPE integer USING round("down_payment_cents" * 100)::integer;--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "system_price_cents" SET DATA TYPE integer USING round("system_price_cents" * 100)::integer;--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "principal_cents" SET DATA TYPE integer USING round("principal_cents" * 100)::integer;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_down_payment_cents_non_negative" CHECK ("quotes"."down_payment_cents" >= 0);--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_principal_cents_positive" CHECK ("quotes"."principal_cents" > 0);--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_principal_cents_matches_price" CHECK ("quotes"."principal_cents" = "quotes"."system_price_cents" - "quotes"."down_payment_cents");