-- CreateEnum
CREATE TYPE "ReceivableKind" AS ENUM ('RENT');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('MAINTENANCE', 'INSURANCE', 'MANAGEMENT', 'FINANCING', 'OPERATING', 'MODERNIZATION', 'OTHER');

-- CreateTable
CREATE TABLE "RentReceivable" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "period" DATE NOT NULL,
    "kind" "ReceivableKind" NOT NULL DEFAULT 'RENT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "dueOn" DATE NOT NULL,
    "baseRent" DECIMAL(16,2) NOT NULL,
    "operating" DECIMAL(16,2) NOT NULL,
    "heating" DECIMAL(16,2) NOT NULL,
    "bookedOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedOn" DATE,
    "voidReason" TEXT,

    CONSTRAINT "RentReceivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "receivedOn" DATE NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedOn" DATE,
    "voidReason" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "allocatedOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedOn" DATE,
    "voidReason" TEXT,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "paidOn" DATE NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "vendor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedOn" DATE,
    "voidReason" TEXT,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentReceivable_period_idx" ON "RentReceivable"("period");

-- CreateIndex
CREATE UNIQUE INDEX "RentReceivable_leaseId_period_kind_revision_key" ON "RentReceivable"("leaseId", "period", "kind", "revision");

-- CreateIndex
CREATE INDEX "Payment_propertyId_receivedOn_idx" ON "Payment"("propertyId", "receivedOn");

-- CreateIndex
CREATE INDEX "Payment_receivedOn_idx" ON "Payment"("receivedOn");

-- CreateIndex
CREATE INDEX "Allocation_paymentId_idx" ON "Allocation"("paymentId");

-- CreateIndex
CREATE INDEX "Allocation_receivableId_idx" ON "Allocation"("receivableId");

-- CreateIndex
CREATE INDEX "Expense_propertyId_paidOn_idx" ON "Expense"("propertyId", "paidOn");

-- CreateIndex
CREATE INDEX "Expense_paidOn_idx" ON "Expense"("paidOn");

-- CreateIndex
CREATE INDEX "Expense_unitId_idx" ON "Expense"("unitId");

-- AddForeignKey
ALTER TABLE "RentReceivable" ADD CONSTRAINT "RentReceivable_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "RentReceivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "RentalUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "RentReceivable_active_period" ON "RentReceivable" ("leaseId", "period", "kind") WHERE "voidedOn" IS NULL;
ALTER TABLE "RentReceivable" ADD CONSTRAINT "RentReceivable_amounts" CHECK ("baseRent" >= 0 AND "operating" >= 0 AND "heating" >= 0 AND "revision" >= 0 AND EXTRACT(DAY FROM "period") = 1);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_positive" CHECK ("amount" > 0 AND ("voidedOn" IS NULL OR "voidedOn" >= "receivedOn"));
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_positive" CHECK ("amount" > 0 AND ("voidedOn" IS NULL OR "voidedOn" >= "paidOn"));
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_positive" CHECK ("amount" > 0 AND ("voidedOn" IS NULL OR "voidedOn" >= "allocatedOn"));
