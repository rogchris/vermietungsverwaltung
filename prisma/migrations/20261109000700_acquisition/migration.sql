-- CreateEnum
CREATE TYPE "ScenarioKind" AS ENUM ('CONSERVATIVE', 'BASE', 'OPTIMISTIC');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "acquisitionProjectId" TEXT,
ALTER COLUMN "propertyId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AcquisitionProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "houseNumber" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "type" "PropertyType" NOT NULL,
    "builtYear" INTEGER,
    "landArea" DECIMAL(12,2),
    "livingArea" DECIMAL(12,2) NOT NULL,
    "purchaseDate" DATE,
    "purchasePrice" DECIMAL(14,2) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "condition" TEXT NOT NULL DEFAULT '',
    "renovationNotes" TEXT NOT NULL DEFAULT '',
    "expectedAnnualRent" DECIMAL(16,2) NOT NULL,
    "vacancyRate" DECIMAL(7,4) NOT NULL,
    "convertedAt" TIMESTAMP(3),
    "acquiredPropertyId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcquisitionProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcquisitionScenario" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "ScenarioKind" NOT NULL,
    "assumptionsOn" DATE NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "transferTaxRate" DECIMAL(7,4) NOT NULL,
    "notaryRate" DECIMAL(7,4) NOT NULL,
    "registryRate" DECIMAL(7,4) NOT NULL,
    "brokerRate" DECIMAL(7,4) NOT NULL,
    "renovation" DECIMAL(16,2) NOT NULL,
    "otherCosts" DECIMAL(16,2) NOT NULL,
    "reserve" DECIMAL(16,2) NOT NULL,
    "equity" DECIMAL(16,2) NOT NULL,
    "annualRent" DECIMAL(16,2) NOT NULL,
    "vacancyRate" DECIMAL(7,4) NOT NULL,
    "lossRate" DECIMAL(7,4) NOT NULL,
    "ownerCosts" DECIMAL(16,2) NOT NULL,
    "maintenance" DECIMAL(16,2) NOT NULL,

    CONSTRAINT "AcquisitionScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcquisitionLoan" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "principal" DECIMAL(16,2) NOT NULL,
    "annualRate" DECIMAL(7,4) NOT NULL,
    "initialRepayment" DECIMAL(7,4) NOT NULL,
    "fixedMonths" INTEGER NOT NULL,
    "startsMonth" INTEGER NOT NULL DEFAULT 1,
    "refinancesId" TEXT,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "AcquisitionLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanExtraPayment" (
    "loanId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,

    CONSTRAINT "LoanExtraPayment_pkey" PRIMARY KEY ("loanId","month")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcquisitionProject_acquiredPropertyId_key" ON "AcquisitionProject"("acquiredPropertyId");

-- CreateIndex
CREATE INDEX "AcquisitionProject_convertedAt_name_idx" ON "AcquisitionProject"("convertedAt", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AcquisitionScenario_projectId_kind_key" ON "AcquisitionScenario"("projectId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "AcquisitionLoan_refinancesId_key" ON "AcquisitionLoan"("refinancesId");

-- CreateIndex
CREATE INDEX "AcquisitionLoan_scenarioId_idx" ON "AcquisitionLoan"("scenarioId");

-- CreateIndex
CREATE INDEX "Document_acquisitionProjectId_createdAt_idx" ON "Document"("acquisitionProjectId", "createdAt");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_acquisitionProjectId_fkey" FOREIGN KEY ("acquisitionProjectId") REFERENCES "AcquisitionProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcquisitionProject" ADD CONSTRAINT "AcquisitionProject_acquiredPropertyId_fkey" FOREIGN KEY ("acquiredPropertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcquisitionScenario" ADD CONSTRAINT "AcquisitionScenario_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AcquisitionProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcquisitionLoan" ADD CONSTRAINT "AcquisitionLoan_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "AcquisitionScenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcquisitionLoan" ADD CONSTRAINT "AcquisitionLoan_refinancesId_fkey" FOREIGN KEY ("refinancesId") REFERENCES "AcquisitionLoan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanExtraPayment" ADD CONSTRAINT "LoanExtraPayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "AcquisitionLoan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Document" ADD CONSTRAINT "Document_parent" CHECK (num_nonnulls("propertyId", "acquisitionProjectId") = 1 AND ("acquisitionProjectId" IS NULL OR num_nonnulls("unitId", "leaseId", "expenseId") = 0));
ALTER TABLE "AcquisitionProject" ADD CONSTRAINT "AcquisitionProject_values" CHECK ("purchasePrice" > 0 AND "expectedAnnualRent" >= 0 AND "vacancyRate" BETWEEN 0 AND 100 AND "livingArea" >= 0 AND ("landArea" IS NULL OR "landArea" >= 0));
ALTER TABLE "AcquisitionLoan" ADD CONSTRAINT "AcquisitionLoan_values" CHECK ("principal" > 0 AND "annualRate" BETWEEN 0 AND 100 AND "initialRepayment" > 0 AND "initialRepayment" <= 100 AND "fixedMonths" BETWEEN 1 AND 600 AND "startsMonth" >= 1);
ALTER TABLE "LoanExtraPayment" ADD CONSTRAINT "LoanExtraPayment_values" CHECK ("amount" > 0 AND "month" BETWEEN 1 AND 600);
ALTER TYPE "DocumentType" ADD VALUE 'EXPOSE';
