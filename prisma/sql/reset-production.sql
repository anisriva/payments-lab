-- Reset production schema (destructive — wipes all data)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('razorpay', 'dodo', 'stripe', 'paypal');

-- CreateEnum
CREATE TYPE "PaymentEnvironment" AS ENUM ('test', 'live');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'completed');

-- CreateEnum
CREATE TYPE "BillingMode" AS ENUM ('monthly', 'yearly');

-- CreateEnum
CREATE TYPE "PlatformOfferingPriceType" AS ENUM ('one_time', 'recurring');

-- CreateEnum
CREATE TYPE "ProjectOfferingPriceType" AS ENUM ('fixed', 'custom', 'recurring');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('order', 'subscription_initial', 'subscription_renewal', 'refund');

-- CreateEnum
CREATE TYPE "MarketKey" AS ENUM ('TIER_1', 'TIER_2', 'TIER_3', 'TIER_4');

-- CreateTable
CREATE TABLE "markets" (
    "id" TEXT NOT NULL,
    "key" "MarketKey" NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "defaultCurrencyCode" CHAR(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "currencySymbol" VARCHAR(5) NOT NULL,
    "countryFlagEmoji" VARCHAR(10) NOT NULL,
    "countryPhoneExtension" VARCHAR(6) NOT NULL,
    "nationalLanguage" CHAR(2) NOT NULL,
    "timezone" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "country_market_maps" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "country_market_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(150),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_plans" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_plan_prices" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "billingMode" "BillingMode" NOT NULL,
    "unitAmount" INTEGER NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "providerPlanRefs" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_plan_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_offerings" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "unitLabel" VARCHAR(30),
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "maxQuantity" INTEGER NOT NULL,
    "quantityStep" INTEGER NOT NULL DEFAULT 1,
    "quickPicks" INTEGER[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_offering_prices" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "priceType" "PlatformOfferingPriceType" NOT NULL,
    "billingMode" "BillingMode",
    "unitAmount" INTEGER NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "providerPlanRefs" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_offering_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_subscriptions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "platformPlanPriceId" TEXT,
    "platformOfferingPriceId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "provider" "PaymentProvider" NOT NULL,
    "environment" "PaymentEnvironment" NOT NULL,
    "providerSubscriptionId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'incomplete',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_orders" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "platformOfferingPriceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitAmount" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "environment" "PaymentEnvironment" NOT NULL,
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_payments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "kind" "PaymentKind" NOT NULL,
    "platformSubscriptionId" TEXT,
    "platformOrderId" TEXT,
    "amount" INTEGER NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "environment" "PaymentEnvironment" NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_provider_rules" (
    "provider" "PaymentProvider" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "receiverCountries" TEXT[],
    "payerCountries" TEXT[],
    "currencies" TEXT[],
    "webhookRef" TEXT,
    "webhookRegisteredAt" TIMESTAMP(3),
    "webhookError" TEXT,
    "validationReport" JSONB,
    "validatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_provider_rules_pkey" PRIMARY KEY ("provider")
);

-- CreateTable
CREATE TABLE "platform_provider_events" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "headers" JSONB NOT NULL,
    "rawBody" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "note" TEXT,
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_provider_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_users" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_payment_connections" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "environment" "PaymentEnvironment" NOT NULL,
    "credentialsEnc" TEXT NOT NULL,
    "displayHint" VARCHAR(64) NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "verifiedAt" TIMESTAMP(3),
    "webhookRef" TEXT,
    "webhookActive" BOOLEAN,
    "webhookRegisteredAt" TIMESTAMP(3),
    "webhookError" TEXT,
    "validationReport" JSONB,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_payment_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_provider_rules" (
    "provider" "PaymentProvider" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "receiverCountries" TEXT[],
    "payerCountries" TEXT[],
    "currencies" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_provider_rules_pkey" PRIMARY KEY ("provider")
);

-- CreateTable
CREATE TABLE "project_provider_events" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "connectionId" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "headers" JSONB NOT NULL,
    "rawBody" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "note" TEXT,
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_provider_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_offerings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "module" VARCHAR(50) NOT NULL,
    "moduleItemId" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_offering_prices" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "marketId" TEXT,
    "priceType" "ProjectOfferingPriceType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "billingMode" "BillingMode",
    "providerPlanRefs" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_offering_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_orders" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectUserId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "projectOfferingPriceId" TEXT NOT NULL,
    "buyerEmail" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitAmount" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "environment" "PaymentEnvironment" NOT NULL,
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_subscriptions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectUserId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "projectOfferingPriceId" TEXT NOT NULL,
    "buyerEmail" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "provider" "PaymentProvider" NOT NULL,
    "environment" "PaymentEnvironment" NOT NULL,
    "providerSubscriptionId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'incomplete',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_payments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "projectSubscriptionId" TEXT,
    "projectOrderId" TEXT,
    "amount" INTEGER NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "markets_key_key" ON "markets"("key");

-- CreateIndex
CREATE UNIQUE INDEX "countries_countryCode_key" ON "countries"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "country_market_maps_countryId_key" ON "country_market_maps"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_users_email_key" ON "platform_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "platform_plans_key_key" ON "platform_plans"("key");

-- CreateIndex
CREATE UNIQUE INDEX "platform_plan_prices_planId_marketId_billingMode_key" ON "platform_plan_prices"("planId", "marketId", "billingMode");

-- CreateIndex
CREATE UNIQUE INDEX "platform_offerings_key_key" ON "platform_offerings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "platform_offering_prices_offeringId_marketId_priceType_bill_key" ON "platform_offering_prices"("offeringId", "marketId", "priceType", "billingMode");

-- CreateIndex
CREATE UNIQUE INDEX "platform_subscriptions_providerSubscriptionId_key" ON "platform_subscriptions"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "platform_subscriptions_provider_createdAt_idx" ON "platform_subscriptions"("provider", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "platform_orders_providerOrderId_key" ON "platform_orders"("providerOrderId");

-- CreateIndex
CREATE INDEX "platform_orders_provider_createdAt_idx" ON "platform_orders"("provider", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "platform_payments_providerPaymentId_key" ON "platform_payments"("providerPaymentId");

-- CreateIndex
CREATE INDEX "platform_payments_provider_createdAt_idx" ON "platform_payments"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "platform_provider_events_receivedAt_idx" ON "platform_provider_events"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "platform_provider_events_provider_providerEventId_key" ON "platform_provider_events"("provider", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_name_key" ON "projects"("name");

-- CreateIndex
CREATE UNIQUE INDEX "project_users_projectId_email_key" ON "project_users"("projectId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "project_payment_connections_projectId_provider_environment_key" ON "project_payment_connections"("projectId", "provider", "environment");

-- CreateIndex
CREATE INDEX "project_provider_events_receivedAt_idx" ON "project_provider_events"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "project_provider_events_provider_connectionId_providerEvent_key" ON "project_provider_events"("provider", "connectionId", "providerEventId");

-- CreateIndex
CREATE INDEX "project_offerings_projectId_idx" ON "project_offerings"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_offerings_module_moduleItemId_key" ON "project_offerings"("module", "moduleItemId");

-- CreateIndex
CREATE UNIQUE INDEX "project_offering_prices_offeringId_marketId_priceType_billi_key" ON "project_offering_prices"("offeringId", "marketId", "priceType", "billingMode");

-- CreateIndex
CREATE UNIQUE INDEX "project_orders_providerOrderId_key" ON "project_orders"("providerOrderId");

-- CreateIndex
CREATE INDEX "project_orders_projectId_createdAt_idx" ON "project_orders"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "project_subscriptions_providerSubscriptionId_key" ON "project_subscriptions"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "project_subscriptions_projectId_createdAt_idx" ON "project_subscriptions"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "project_payments_providerPaymentId_key" ON "project_payments"("providerPaymentId");

-- CreateIndex
CREATE INDEX "project_payments_projectId_createdAt_idx" ON "project_payments"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "country_market_maps" ADD CONSTRAINT "country_market_maps_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "country_market_maps" ADD CONSTRAINT "country_market_maps_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_plan_prices" ADD CONSTRAINT "platform_plan_prices_planId_fkey" FOREIGN KEY ("planId") REFERENCES "platform_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_plan_prices" ADD CONSTRAINT "platform_plan_prices_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_offering_prices" ADD CONSTRAINT "platform_offering_prices_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "platform_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_offering_prices" ADD CONSTRAINT "platform_offering_prices_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "platform_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_platformPlanPriceId_fkey" FOREIGN KEY ("platformPlanPriceId") REFERENCES "platform_plan_prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_platformOfferingPriceId_fkey" FOREIGN KEY ("platformOfferingPriceId") REFERENCES "platform_offering_prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_orders" ADD CONSTRAINT "platform_orders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_orders" ADD CONSTRAINT "platform_orders_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "platform_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_orders" ADD CONSTRAINT "platform_orders_platformOfferingPriceId_fkey" FOREIGN KEY ("platformOfferingPriceId") REFERENCES "platform_offering_prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_payments" ADD CONSTRAINT "platform_payments_platformOrderId_fkey" FOREIGN KEY ("platformOrderId") REFERENCES "platform_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_payments" ADD CONSTRAINT "platform_payments_platformSubscriptionId_fkey" FOREIGN KEY ("platformSubscriptionId") REFERENCES "platform_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_users" ADD CONSTRAINT "project_users_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_payment_connections" ADD CONSTRAINT "project_payment_connections_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_provider_events" ADD CONSTRAINT "project_provider_events_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "project_payment_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_offerings" ADD CONSTRAINT "project_offerings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_offering_prices" ADD CONSTRAINT "project_offering_prices_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "project_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_offering_prices" ADD CONSTRAINT "project_offering_prices_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_orders" ADD CONSTRAINT "project_orders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_orders" ADD CONSTRAINT "project_orders_projectUserId_fkey" FOREIGN KEY ("projectUserId") REFERENCES "project_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_orders" ADD CONSTRAINT "project_orders_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "project_payment_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_orders" ADD CONSTRAINT "project_orders_projectOfferingPriceId_fkey" FOREIGN KEY ("projectOfferingPriceId") REFERENCES "project_offering_prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_subscriptions" ADD CONSTRAINT "project_subscriptions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_subscriptions" ADD CONSTRAINT "project_subscriptions_projectUserId_fkey" FOREIGN KEY ("projectUserId") REFERENCES "project_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_subscriptions" ADD CONSTRAINT "project_subscriptions_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "project_payment_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_subscriptions" ADD CONSTRAINT "project_subscriptions_projectOfferingPriceId_fkey" FOREIGN KEY ("projectOfferingPriceId") REFERENCES "project_offering_prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_payments" ADD CONSTRAINT "project_payments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_payments" ADD CONSTRAINT "project_payments_projectOrderId_fkey" FOREIGN KEY ("projectOrderId") REFERENCES "project_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_payments" ADD CONSTRAINT "project_payments_projectSubscriptionId_fkey" FOREIGN KEY ("projectSubscriptionId") REFERENCES "project_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


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
