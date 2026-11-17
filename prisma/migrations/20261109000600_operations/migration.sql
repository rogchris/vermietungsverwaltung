CREATE TABLE "RentGenerationRun" (
  "day" DATE NOT NULL,
  "period" DATE NOT NULL,
  "createdCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RentGenerationRun_pkey" PRIMARY KEY ("day"),
  CONSTRAINT "RentGenerationRun_count" CHECK ("createdCount" >= 0)
);

ALTER TABLE "Tenant" ADD COLUMN "anonymizedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'vermietung_app') THEN
    REVOKE INSERT, UPDATE, DELETE ON TABLE public._prisma_migrations FROM vermietung_app;
  END IF;
END $$;
