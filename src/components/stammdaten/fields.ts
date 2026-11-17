import type { Lease, Property, RentalUnit, RentCondition, Tenant } from "@/generated/prisma/client";
import { states } from "@/modules/properties/validation";
import { editableUnitStatuses } from "@/modules/rental-units/validation";
import { chargeModes, choices, dateInput, propertyTypes, rentModels, unitStatuses, unitUses } from "@/modules/stammdaten/presentation";
import type { Choice, Field } from "./form";

export function propertyFields(value?: Omit<Property, "archivedAt">): Field[] {
  return [
    { name: "name", label: "Objektbezeichnung", value: value?.name, required: true, maxLength: 120 },
    { name: "type", label: "Immobilientyp", type: "select", options: choices(propertyTypes), value: value?.type ?? "MULTI_FAMILY", required: true },
    { name: "street", label: "Straße", value: value?.street, required: true, maxLength: 120 },
    { name: "houseNumber", label: "Hausnummer", value: value?.houseNumber, required: true, maxLength: 20 },
    { name: "postalCode", label: "Postleitzahl", value: value?.postalCode, required: true, maxLength: 5 },
    { name: "city", label: "Ort", value: value?.city, required: true, maxLength: 100 },
    { name: "state", label: "Bundesland", type: "select", options: [{ value: "", label: "Bitte wählen" }, ...choices(states)], value: value?.state, required: true },
    { name: "builtYear", label: "Baujahr", type: "integer", value: value?.builtYear?.toString(), maxLength: 4 },
    { name: "livingArea", label: "Wohnfläche (m²)", type: "decimal", value: value?.livingArea.toString(), required: true, maxLength: 13 },
    { name: "landArea", label: "Grundstücksfläche (m²)", type: "decimal", value: value?.landArea?.toString(), maxLength: 13 },
    { name: "purchaseDate", label: "Kaufdatum", type: "date", value: dateInput(value?.purchaseDate) },
    { name: "purchasePrice", label: "Kaufpreis (EUR)", type: "decimal", value: value?.purchasePrice?.toString(), maxLength: 15 },
    { name: "description", label: "Beschreibung", type: "textarea", value: value?.description, maxLength: 4000 },
  ];
}

export function unitFields(value?: RentalUnit): Field[] {
  return [
    { name: "label", label: "Einheitsbezeichnung", value: value?.label, required: true, maxLength: 80 },
    { name: "floor", label: "Etage", value: value?.floor ?? undefined, maxLength: 60 },
    { name: "livingArea", label: "Wohnfläche (m²)", type: "decimal", value: value?.livingArea.toString(), required: true, maxLength: 13 },
    { name: "rooms", label: "Zimmeranzahl", type: "decimal", value: value?.rooms?.toString(), maxLength: 6 },
    { name: "use", label: "Nutzungsart", type: "select", options: choices(unitUses), value: value?.use ?? "RESIDENTIAL", required: true },
    { name: "status", label: "Grundstatus", type: "select", options: editableUnitStatuses.map((status) => ({ value: status, label: unitStatuses[status] })),
      value: value?.status ?? "VACANT", required: true, hint: "Ein laufender Mietvertrag zeigt die Einheit als vermietet an." },
    { name: "parkingSpaces", label: "Stellplätze", type: "integer", value: String(value?.parkingSpaces ?? 0), required: true, maxLength: 3 },
    { name: "features", label: "Ausstattung", type: "textarea", value: value?.features, maxLength: 4000 },
  ];
}

export function tenantFields(value?: Tenant): Field[] {
  return [
    { name: "firstName", label: "Vorname", value: value?.firstName, required: true, maxLength: 100 },
    { name: "lastName", label: "Nachname", value: value?.lastName, required: true, maxLength: 100 },
    { name: "street", label: "Straße", value: value?.street, required: true, maxLength: 120 },
    { name: "houseNumber", label: "Hausnummer", value: value?.houseNumber, required: true, maxLength: 20 },
    { name: "postalCode", label: "Postleitzahl", value: value?.postalCode, required: true, maxLength: 20 },
    { name: "city", label: "Ort", value: value?.city, required: true, maxLength: 100 },
    { name: "countryCode", label: "Ländercode", value: value?.countryCode ?? "DE", required: true, maxLength: 2, hint: "Zweistellig, zum Beispiel DE." },
    { name: "phone", label: "Telefon", type: "tel", value: value?.phone ?? undefined, maxLength: 40 },
    { name: "email", label: "E-Mail", type: "email", value: value?.email ?? undefined, maxLength: 254 },
  ];
}

export function leaseDetailFields(value?: Lease): Field[] {
  return [
    { name: "endsOn", label: "Vertragsende", type: "date", value: dateInput(value?.endsOn), hint: "Leer lassen für einen unbefristeten Vertrag." },
    { name: "rentModel", label: "Mietmodell", type: "select", options: choices(rentModels), value: value?.rentModel ?? "FIXED", required: true },
    { name: "dueDay", label: "Fälligkeitstag (Kalendertag)", type: "integer", value: String(value?.dueDay ?? 3), required: true, maxLength: 2 },
    { name: "deposit", label: "Kaution (EUR)", type: "decimal", value: value?.deposit.toString() ?? "0", required: true, maxLength: 15 },
    { name: "depositTerms", label: "Kautionsvereinbarung", type: "textarea", value: value?.depositTerms, maxLength: 2000 },
  ];
}

function rentFields(value?: RentCondition): Field[] {
  return [
    { name: "baseRent", label: "Nettokaltmiete (EUR)", type: "decimal", value: value?.baseRent.toString(), required: true, maxLength: 15 },
    { name: "operatingMode", label: "Betriebskostenart", type: "select", options: choices(chargeModes), value: value?.operatingMode ?? "NONE", required: true },
    { name: "operatingCosts", label: "Betriebskosten (EUR)", type: "decimal", value: value?.operatingCosts.toString() ?? "0", required: true, maxLength: 15 },
    { name: "heatingMode", label: "Heizkostenart", type: "select", options: choices(chargeModes), value: value?.heatingMode ?? "NONE", required: true },
    { name: "heatingCosts", label: "Heizkosten (EUR)", type: "decimal", value: value?.heatingCosts.toString() ?? "0", required: true, maxLength: 15 },
  ];
}

export function leaseCreateFields(tenantChoices: Choice[]): Field[] {
  return [
    { name: "tenantIds", label: "Vertragsparteien", type: "checkboxes", options: tenantChoices, required: true },
    { name: "startsOn", label: "Vertragsbeginn", type: "date", required: true },
    ...leaseDetailFields(),
    ...rentFields(),
  ];
}

export function conditionFields(latest?: RentCondition): Field[] {
  return [
    { name: "effectiveFrom", label: "Gültig ab", type: "date", required: true },
    ...rentFields(latest),
  ];
}
