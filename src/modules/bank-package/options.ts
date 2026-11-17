export const bankSections = {
  object: "Objekt und Kaufdaten",
  capital: "Erwerbskosten und Kapitalbedarf",
  funding: "Eigenkapital und Finanzierung",
  loans: "Darlehen und Tilgungspläne",
  rents: "Mietaufstellung und Ertrag",
  cashflow: "Laufende Kosten und Cashflow",
  yield: "Renditekennzahlen",
  scenarios: "Szenarienvergleich",
  risks: "Risiken und offene Punkte",
  documents: "Anlagen und Vollständigkeit",
} as const;

export const evidenceTypes = {
  expose: "Exposé / Objektunterlagen",
  purchase: "Kaufpreis- oder Vertragsnachweis",
  registry: "Grundbuchauszug",
  rents: "Mietverträge oder Mieterliste",
  costs: "Nachweis laufender Kosten",
  equity: "Eigenkapitalnachweis",
  financing: "Finanzierungsangebot",
  works: "Sanierungskostennachweis",
} as const;

export const scenarioNames = { BASE: "Basis", CONSERVATIVE: "Konservativ", OPTIMISTIC: "Optimistisch" } as const;
export const sectionKeys = Object.keys(bankSections) as (keyof typeof bankSections)[];
export const evidenceKeys = Object.keys(evidenceTypes) as (keyof typeof evidenceTypes)[];
export const scenarioKeys = Object.keys(scenarioNames) as (keyof typeof scenarioNames)[];
export const provenance = { documented: "Belegt", entered: "Vom Nutzer angegeben", estimate: "Geschätzt", calculated: "Berechnet" } as const;
