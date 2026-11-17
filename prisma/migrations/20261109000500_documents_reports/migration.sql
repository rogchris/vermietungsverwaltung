-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CONTRACT', 'PHOTO', 'INVOICE', 'STATEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('PROPERTY', 'RENT', 'TENANTS', 'PAYMENTS', 'ARREARS', 'CASHFLOW', 'ANNUAL');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('QUEUED', 'RUNNING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "leaseId" TEXT,
    "expenseId" TEXT,
    "type" "DocumentType" NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT,
    "type" "ReportType" NOT NULL,
    "period" DATE NOT NULL,
    "months" INTEGER NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "failure" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_propertyId_createdAt_idx" ON "Document"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "Document_unitId_idx" ON "Document"("unitId");

-- CreateIndex
CREATE INDEX "Document_leaseId_idx" ON "Document"("leaseId");

-- CreateIndex
CREATE INDEX "Document_expenseId_idx" ON "Document"("expenseId");

-- CreateIndex
CREATE INDEX "ReportJob_status_availableAt_idx" ON "ReportJob"("status", "availableAt");

-- CreateIndex
CREATE INDEX "ReportJob_userId_createdAt_idx" ON "ReportJob"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportJob_propertyId_idx" ON "ReportJob"("propertyId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "RentalUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportJob" ADD CONSTRAINT "ReportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportJob" ADD CONSTRAINT "ReportJob_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Document" ADD CONSTRAINT "Document_metadata" CHECK (num_nonnulls("unitId", "leaseId", "expenseId") <= 1 AND "size" BETWEEN 1 AND 10485760 AND "mime" IN ('application/pdf', 'image/jpeg', 'image/png') AND "sha256" ~ '^[0-9a-f]{64}$');
ALTER TABLE "ReportJob" ADD CONSTRAINT "ReportJob_period" CHECK ("months" IN (1, 12) AND "attempts" BETWEEN 0 AND 3 AND EXTRACT(DAY FROM "period") = 1);
