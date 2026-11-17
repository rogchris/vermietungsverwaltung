import { expect, it } from "vitest";
import { bankInput } from "../../src/modules/bank-package/validation";
import { evidenceKeys, sectionKeys } from "../../src/modules/bank-package/options";

function input(rentRows: string, sections: string[] = sectionKeys) {
  return { id: crypto.randomUUID(), sections, evidence: Object.fromEntries(evidenceKeys.map((key) => [key, ""])), rentRows, riskNotes: "" };
}

it("normalisiert Mietpositionen ohne Gleitkommaarithmetik und erhält ihre Herkunft", () => {
  const parsed = bankInput.parse(input("EG | vermietet | 800,25 | Angabe\nOG | geplant | 950.10 | Schätzung"));
  expect(parsed.rentRows).toEqual([
    { unit: "EG", status: "vermietet", monthly: "800.25", source: "entered" },
    { unit: "OG", status: "geplant", monthly: "950.10", source: "estimate" },
  ]);
});

it.each(["EG | leer | -5 | Angabe", "EG | vermietet | 1.234 | Angabe", "EG | unbekannt | 900 | Angabe", "EG | geplant | 900 | Belegt"])(
  "weist ungültige oder eigenmächtig als belegt markierte Mietpositionen ab (%s)", (row) => {
    expect(bankInput.safeParse(input(row)).success).toBe(false);
  },
);

it("behält die Vollständigkeitsprüfung und ordnet die Kapitel eindeutig", () => {
  expect(bankInput.parse(input("", ["risks", "object", "risks"])).sections).toEqual(["object", "risks", "documents"]);
});
