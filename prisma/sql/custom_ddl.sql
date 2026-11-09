-- Custom DDL — applied after `prisma db push` (Prisma can't express these).
-- Idempotent: safe to re-run on every build.

-- PlatformSubscription: exactly one of platformPlanPriceId / platformOfferingPriceId
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'platform_subscriptions_one_price_chk'
  ) THEN
    ALTER TABLE "platform_subscriptions"
      ADD CONSTRAINT "platform_subscriptions_one_price_chk"
      CHECK (("platformPlanPriceId" IS NOT NULL)::int + ("platformOfferingPriceId" IS NOT NULL)::int = 1);
  END IF;
END $$;

-- One non-ended base-plan subscription per project
CREATE UNIQUE INDEX IF NOT EXISTS "platform_subscriptions_one_base_plan_per_project"
  ON "platform_subscriptions" ("projectId")
  WHERE "platformPlanPriceId" IS NOT NULL AND "status" NOT IN ('canceled', 'completed');
