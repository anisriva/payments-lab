-- Step 9 production migration
-- Covers: working-tree schema before Step 9 (post-7a state) -> current schema (Step 9 changes)
-- Generated with: npx prisma migrate diff --from-schema <pre-9 schema> --to-schema prisma/schema.prisma --script
-- Run in the Neon SQL editor.

-- CreateEnum
CREATE TYPE "PaymentFlow" AS ENUM ('platform', 'project');

-- AlterTable
ALTER TABLE "payment_connections" ADD COLUMN     "validated_at" TIMESTAMP(3),
ADD COLUMN     "validation_report" JSONB,
ADD COLUMN     "webhook_active" BOOLEAN,
ADD COLUMN     "webhook_error" TEXT,
ADD COLUMN     "webhook_ref" TEXT,
ADD COLUMN     "webhook_registered_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payment_provider_settings" DROP CONSTRAINT "payment_provider_settings_pkey",
ADD COLUMN     "flow" "PaymentFlow" NOT NULL DEFAULT 'platform',
ADD COLUMN     "validated_at" TIMESTAMP(3),
ADD COLUMN     "validation_report" JSONB,
ADD COLUMN     "webhook_error" TEXT,
ADD COLUMN     "webhook_ref" TEXT,
ADD COLUMN     "webhook_registered_at" TIMESTAMP(3),
ADD CONSTRAINT "payment_provider_settings_pkey" PRIMARY KEY ("provider", "flow");

-- Copy provider settings rows for the project audience (9.10)
INSERT INTO "payment_provider_settings"
  ("provider", "flow", "is_enabled", "receiver_countries", "payer_countries", "currencies", "updated_at")
SELECT "provider", 'project', "is_enabled", "receiver_countries", "payer_countries", "currencies", NOW()
FROM "payment_provider_settings" WHERE "flow" = 'platform'
ON CONFLICT DO NOTHING;
