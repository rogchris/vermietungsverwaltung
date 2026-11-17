-- Property-unit history uses inclusive calendar dates. An open end is unbounded.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Lease"
  ADD CONSTRAINT "Lease_unit_date_no_overlap"
  EXCLUDE USING gist ("unitId" WITH =, daterange("startsOn", "endsOn", '[]') WITH &&);
