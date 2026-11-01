-- Step 7a production migration
-- Covers: b307a24 (step 7: BYOP UI) -> working tree (Step 7a catalog schema)
-- Generated with: npx prisma migrate diff --from-schema <pre-7a schema> --to-schema prisma/schema.prisma --script
-- Run in the Neon SQL editor. Then reseed is NOT needed except the countries INSERT below
-- (provider settings and credit rates are created through the Catalog UI).

-- CreateTable
CREATE TABLE "countries" (
    "code" CHAR(2) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "payment_provider_settings" (
    "provider" "PaymentProvider" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "receiver_countries" TEXT[],
    "payer_countries" TEXT[],
    "currencies" TEXT[],
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_provider_settings_pkey" PRIMARY KEY ("provider")
);

-- CreateTable
CREATE TABLE "ai_credit_rates" (
    "id" TEXT NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "rate_minor" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_credit_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_credit_rates_currency_code_key" ON "ai_credit_rates"("currency_code");

-- Static country catalog (from prisma/seed/static/data/countries.ts)
INSERT INTO "countries" ("code", "name", "currency_code") VALUES
    ('IN', 'India', 'INR'),
    ('US', 'United States', 'USD'),
    ('GB', 'United Kingdom', 'GBP'),
    ('DE', 'Germany', 'EUR'),
    ('AE', 'United Arab Emirates', 'AED'),
    ('SG', 'Singapore', 'SGD'),
    ('MY', 'Malaysia', 'MYR')
ON CONFLICT ("code") DO NOTHING;
