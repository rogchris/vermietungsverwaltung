ALTER TABLE "Property"
  ADD CONSTRAINT "Property_positive_areas" CHECK ("livingArea" >= 0 AND "landArea" >= 0),
  ADD CONSTRAINT "Property_nonnegative_price" CHECK ("purchasePrice" >= 0);

ALTER TABLE "RentalUnit"
  ADD CONSTRAINT "RentalUnit_nonnegative_values" CHECK ("livingArea" >= 0 AND "rooms" >= 0 AND "parkingSpaces" >= 0);

ALTER TABLE "Lease"
  ADD CONSTRAINT "Lease_valid_dates" CHECK ("endsOn" >= "startsOn"),
  ADD CONSTRAINT "Lease_valid_due_day" CHECK ("dueDay" BETWEEN 1 AND 31),
  ADD CONSTRAINT "Lease_nonnegative_deposit" CHECK ("deposit" >= 0);

ALTER TABLE "RentCondition"
  ADD CONSTRAINT "RentCondition_nonnegative_charges" CHECK ("baseRent" >= 0 AND "operatingCosts" >= 0 AND "heatingCosts" >= 0),
  ADD CONSTRAINT "RentCondition_consistent_charge_modes" CHECK (
    ("operatingMode" <> 'NONE' OR "operatingCosts" = 0) AND
    ("heatingMode" <> 'NONE' OR "heatingCosts" = 0)
  );
