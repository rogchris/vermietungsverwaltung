ALTER TYPE "ReportType" ADD VALUE 'BANK_PACKAGE';

CREATE TABLE "BankSnapshot" (
    "jobId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL CHECK ("version" > 0),
    "formatVersion" INTEGER NOT NULL CHECK ("formatVersion" > 0),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL CHECK (jsonb_typeof("payload") = 'object'),
    CONSTRAINT "BankSnapshot_pkey" PRIMARY KEY ("jobId"),
    CONSTRAINT "BankSnapshot_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ReportJob"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "BankSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AcquisitionProject"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "BankSnapshot_projectId_version_key" ON "BankSnapshot" ("projectId", "version");

CREATE FUNCTION reject_bank_snapshot_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Bank snapshots are immutable' USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER bank_snapshot_immutable BEFORE UPDATE ON "BankSnapshot"
FOR EACH ROW EXECUTE FUNCTION reject_bank_snapshot_update();

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'vermietung_app') THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "BankSnapshot" FROM vermietung_app;
  END IF;
END $$;
