import { Prisma } from "@/generated/prisma/client";
import { displayDate, displayDecimal, propertyTypes } from "@/modules/stammdaten/presentation";
import { documentTypes } from "@/modules/documents/service";
import { bankSections, evidenceTypes, provenance, scenarioKeys, scenarioNames } from "./options";
import type { BankPayload } from "./snapshot";

const e = (value: string | number) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]!);
const amount = (value: string | null, unit: string) => value === null ? "Nicht erfasst" : displayDecimal(new Prisma.Decimal(value), unit);
const euro = (value: string | null) => amount(value, "€");
function percent(value: string) {
  const [whole, fraction] = new Prisma.Decimal(value).toFixed(4).split(".");
  return whole + "," + fraction.replace(/0+$/, "").padEnd(2, "0") + " %";
}
const date = (value: string | null) => value ? displayDate(new Date(value)) : "Nicht erfasst";
const paragraph = (text: string) => "<p>" + e(text) + "</p>";
const sub = (text: string) => "<h2>" + e(text) + "</h2>";
const calculated = provenance.calculated;
const estimated = provenance.estimate;

function table(headers: string[], rows: (string | number)[][]) {
  return "<table><thead><tr>" + headers.map((header) => "<th>" + e(header) + "</th>").join("") + "</tr></thead><tbody>" +
    rows.map((row) => "<tr>" + row.map((value) => "<td>" + e(value) + "</td>").join("") + "</tr>").join("") +
    "</tbody></table>";
}

const measures = (rows: [string, string | number, string][]) => table(["Position", "Wert", "Herkunft"], rows);

export function renderBankPackageV1(payload: BankPayload, version: number) {
  const project = payload.project;
  const base = payload.scenarios.find((scenario) => scenario.kind === "BASE");
  const attach = new Map(payload.attachments.map((file) => [file.id, file]));
  const evidence = (key: keyof typeof evidenceTypes, fallback = provenance.entered as string) => {
    const id = payload.checklist.find((item) => item.key === key)?.attachmentId;
    const file = id ? attach.get(id) : undefined;
    return file ? provenance.documented + " · " + file.reference : fallback;
  };
  const missingBase = paragraph("Das Basisszenario fehlt. Für diese Übersicht liegen keine berechenbaren Eingaben vor.");
  const result = base?.result;
  const inputs = base?.assumptions;
  const chapters: Record<keyof typeof bankSections, () => string> = {
    object: () => measures([
      ["Objekt", project.name, evidence("expose")],
      ["Anschrift", project.street + " " + project.houseNumber + ", " + project.postalCode + " " + project.city, evidence("expose")],
      ["Objektart", propertyTypes[project.type], evidence("expose")],
      ["Baujahr", project.builtYear ?? "Nicht erfasst", project.builtYear === null ? "-" : evidence("expose")],
      ["Wohnfläche", amount(project.livingArea, "m²"), evidence("expose")],
      ["Grundstück", amount(project.landArea, "m²"), project.landArea === null ? "-" : evidence("expose")],
      ["Kaufpreis", euro(project.purchasePrice), evidence("purchase")],
      ["Kaufdatum", date(project.purchaseDate), project.purchaseDate === null ? "-" : evidence("purchase")],
    ]) + sub("Beschreibung und Zustand") + paragraph(project.description || "Keine Beschreibung erfasst.") +
      paragraph(project.condition || "Zustand nicht erfasst.") + sub("Sanierungsbedarf") + paragraph(project.renovationNotes || "Kein Sanierungsbedarf dokumentiert."),
    capital: () => result && inputs ? measures([
      ["Kaufpreis", euro(project.purchasePrice), evidence("purchase")],
      ["Grunderwerbsteuer · " + percent(inputs.transferTaxRate), euro(result.transferTax), calculated],
      ["Notar · " + percent(inputs.notaryRate), euro(result.notary), calculated],
      ["Grundbuch · " + percent(inputs.registryRate), euro(result.registry), calculated],
      ["Makler · " + percent(inputs.brokerRate), euro(result.broker), calculated],
      ["Sanierung", euro(inputs.renovation), evidence("works", estimated)],
      ["Sonstige Erwerbskosten", euro(inputs.otherCosts), estimated],
      ["Erwerbsnebenkosten", euro(result.ancillary), calculated],
      ["Liquiditätsreserve", euro(inputs.reserve), estimated],
      ["Gesamtkapitalbedarf", euro(result.capitalNeeded), calculated],
    ]) + paragraph("Basis. Die Prozentsätze und Kostenannahmen stammen aus der Projektkalkulation.") : missingBase,
    funding: () => result && inputs ? measures([
      ["Gesamtkapitalbedarf", euro(result.capitalNeeded), calculated],
      ["Eigenkapital", euro(inputs.equity), evidence("equity")],
      ["Fremdkapitalbedarf vor Darlehen", euro(result.fundingNeed), calculated],
      ["Erfasste Erstdarlehen", euro(result.financed), calculated],
      ["Finanzierungslücke", euro(result.gap), calculated],
      ["Finanzierungsüberschuss", euro(result.surplus), calculated],
    ]) + paragraph("Basis. Anschlussdarlehen ersetzen Restschulden und erhöhen die anfängliche Finanzierung nicht.") : missingBase,
    loans: () => {
      const populated = payload.scenarios.filter((item) => item.loans.length);
      if (!populated.length) return paragraph("Keine Darlehen erfasst.");
      return populated.map((item) => sub(scenarioNames[item.kind]) + table(
        ["Darlehen", "Betrag", "Sollzins", "Anfangstilgung", "Beginn / Bindung", "Restschuld"],
        item.loans.map((loan, index) => [loan.label, euro(loan.principal), percent(loan.annualRate), percent(loan.initialRepayment),
          "Monat " + (loan.startsMonth ?? 1) + " / " + loan.fixedMonths, euro(item.result.schedules[index].outstanding)]),
      ) + paragraph("Darlehensbedingungen: " + evidence("financing") + ". Restschuld und Tilgungsplan: " + calculated + ".") +
      item.result.schedules.map((plan) => sub("Tilgungsplan · " + plan.label) + table(
        ["Monat", "Zins", "Regeltilgung", "Sondertilgung", "Zahlung", "Restschuld"],
        plan.schedule.map((row) => [row.calendarMonth, euro(row.interest), euro(row.scheduledPrincipal), euro(row.extra), euro(row.installment), euro(row.outstanding)]),
      )).join("")).join("");
    },
    rents: () => (payload.rentOrigin === "manual" ? paragraph("Mietpositionen aus der Eingabe für diese Bankmappe.") :
      payload.rentOrigin === "portfolio" ? paragraph("Mietpositionen aus der Bestandsverwaltung am Berichtsstand.") : "") + (payload.rents.length ? table(["Einheit", "Status", "Nettokalt / Monat", "Herkunft"], payload.rents.map((row) => [
      row.unit, row.status + (row.effectiveFrom ? " · gültig ab " + date(row.effectiveFrom) : ""), euro(row.monthly), provenance[row.source],
    ])) : paragraph("Keine einzelnen Mietpositionen erfasst.")) + measures([
      ["Nettokaltmiete als vermietet erfasster Einheiten / Monat", euro(payload.rentSummary.currentMonthly), calculated],
      ["Nettokaltmiete als vermietet erfasster Einheiten / Jahr, hochgerechnet", euro(payload.rentSummary.currentAnnual), calculated],
      ["Planmiete aller aufgeführten Einheiten / Jahr", euro(payload.rentSummary.planningAnnual), calculated],
      ["Projektannahme Jahresnettokaltmiete", euro(project.expectedAnnualRent), estimated],
      ["Szenarioannahme Basis / Jahr", euro(inputs?.annualRent ?? null), estimated],
    ]) + paragraph("Die Ertragsrechnung verwendet die jeweilige Szenarioannahme. Die Mietaufstellung dient zur Gegenprüfung. Mietnachweis: " + evidence("rents") + "."),
    cashflow: () => result && inputs ? measures([
      ["Jahresnettokaltmiete", euro(inputs.annualRent), estimated],
      ["Leerstand", euro(result.vacancy), calculated],
      ["Mietausfall nach Leerstand", euro(result.rentLoss), calculated],
      ["Laufende Eigentümerkosten", euro(inputs.ownerCosts), evidence("costs", estimated)],
      ["Instandhaltungsbudget", euro(inputs.maintenance), estimated],
      ["Operativer Cashflow", euro(result.operatingCashflow), calculated],
      ["Kapitaldienst im ersten Jahr", euro(result.annualDebtService), calculated],
      ["Cashflow nach Finanzierung im ersten Jahr", euro(result.cashflow), calculated],
    ]) + paragraph("Basis. Die Werte sind Planwerte für ein volles Jahr.") : missingBase,
    yield: () => table(["Szenario", "Bruttomietrendite", "Operative Rendite", "Eigenkapitalrendite"], scenarioKeys.map((key) => {
      const result = payload.scenarios.find((item) => item.kind === key)?.result;
      return result ? [scenarioNames[key], percent(result.grossYield),
        result.netOperatingYield == null ? "Nicht berechenbar" : percent(result.netOperatingYield),
        result.equityYield == null ? "Nicht berechenbar" : percent(result.equityYield)] : [scenarioNames[key], "Fehlt", "-", "-"];
    })) + paragraph("Berechnete Planwerte. Bruttomietrendite = Jahresnettokaltmiete ÷ Kaufpreis. Operative Rendite = operativer Jahres-Cashflow ÷ Gesamtkapitalbedarf. Eigenkapitalrendite = Jahres-Cashflow nach Finanzierung ÷ Eigenkapital.") +
      paragraph("Die Eigenkapitalrendite berücksichtigt die erfasste Finanzierung. Offene Finanzierungslücken stehen im Szenarienvergleich."),
    scenarios: () => table(["Szenario", "Kapitalbedarf", "Eigenkapital", "Lücke", "Kapitaldienst", "Cashflow"],
      scenarioKeys.map((key) => {
        const scenario = payload.scenarios.find((item) => item.kind === key);
        return scenario ? [scenarioNames[key], euro(scenario.result.capitalNeeded), euro(scenario.assumptions.equity), euro(scenario.result.gap),
          euro(scenario.result.annualDebtService), euro(scenario.result.cashflow)] : [scenarioNames[key], "Fehlt", "-", "-", "-", "-"];
      })) + paragraph("Eigenkapital: " + evidence("equity") + ". Kapitalbedarf, Lücke, Kapitaldienst und Cashflow: berechnet.") +
      sub("Annahmen im Vergleich") + table(["Annahme", ...scenarioKeys.map((key) => scenarioNames[key])],
        ([
          ["Annahmenstand", (row: NonNullable<typeof inputs>) => date(row.assumptionsOn)],
          ["Jahresnettokaltmiete", (row: NonNullable<typeof inputs>) => euro(row.annualRent)],
          ["Leerstand / Mietausfall", (row: NonNullable<typeof inputs>) => percent(row.vacancyRate) + " / " + percent(row.lossRate)],
          ["Eigentümerkosten / Instandhaltung", (row: NonNullable<typeof inputs>) => euro(row.ownerCosts) + " / " + euro(row.maintenance)],
          ["Steuer / Notar / Grundbuch / Makler", (row: NonNullable<typeof inputs>) => [row.transferTaxRate, row.notaryRate, row.registryRate, row.brokerRate].map(percent).join(" / ")],
          ["Sanierung / sonstige Kosten / Reserve", (row: NonNullable<typeof inputs>) => [row.renovation, row.otherCosts, row.reserve].map(euro).join(" / ")],
        ] as const).map(([label, format]) => [label, ...scenarioKeys.map((key) => {
          const row = payload.scenarios.find((item) => item.kind === key)?.assumptions;
          return row ? format(row) : "Fehlt";
        })])) + paragraph("Mieten, Ausfallquoten, Kosten und Prozentsätze sind Annahmen.") +
      payload.scenarios.filter(({ assumptions }) => assumptions.source).map(({ kind, assumptions }) =>
        paragraph(scenarioNames[kind] + " · Quelle: " + assumptions.source)).join(""),
    risks: () => payload.risks.length ? table(["Risiko oder Prüfpunkt", "Herkunft"], payload.risks.map((risk) => [risk.text, provenance[risk.source]])) :
      paragraph("Aus den gespeicherten Eingaben wurden keine der automatisch geprüften Auffälligkeiten erkannt."),
    documents: () => sub("Vollständigkeitsprüfung") + table(["Erwarteter Nachweis", "Status"], payload.checklist.map((item) => [
      evidenceTypes[item.key], item.attachmentId ? "Vorhanden · " + (attach.get(item.attachmentId)?.reference ?? "") : "Fehlt",
    ])) + sub("Anlagenverzeichnis") + (payload.attachments.length ? table(["Nr.", "Nachweis", "Typ", "Erfasst am", "Datei"],
      payload.attachments.map((file) => [file.reference, file.filename, documentTypes[file.type], date(file.createdAt), (payload.appendices ?? []).includes(file.id) ? "Angehängt" : file.available ? "Vorhanden" : "Fehlt"])) :
      paragraph("Keine Anlagen hinterlegt.")) + paragraph("Ausgewählte Anlagen folgen am Ende der PDF-Datei. Originaldateien sind zur jeweiligen Version im geschützten Bereich abrufbar."),
  };

  return `<!doctype html><html lang="de"><meta charset="utf-8"><title>Bankmappe - ${e(project.name)}</title>
<style>
@page{size:A4} *{box-sizing:border-box} body{margin:0;color:#18262f;font:10pt Arial,sans-serif;line-height:1.45}
h1,h2,h3{line-height:1.18;break-after:avoid;overflow-wrap:anywhere} h1{font-size:27pt;margin:0 0 8mm}
h2{font-size:13pt;margin:7mm 0 3mm;color:#1d5260} p{margin:3mm 0;white-space:pre-wrap;overflow-wrap:anywhere}
.cover{min-height:235mm;padding:18mm 7mm 0;border-top:2mm solid #1d5260}
.cover h1{font-size:44pt;margin:31mm 0 4mm;letter-spacing:-1pt} .property{font-size:22pt;color:#1d5260;overflow-wrap:anywhere;margin:0 0 3mm}
.eyebrow{font-size:9pt;letter-spacing:2pt;text-transform:uppercase;color:#1d5260;font-weight:bold}
.cover dl{margin:16mm 0 9mm;border-top:1px solid #aab9be;padding-top:5mm} .cover dt{font-size:9pt;color:#4f646f}
.cover dd{margin:0 0 4mm;font-size:13pt} .muted{color:#53656d;font-size:9pt} .page{break-before:page}
table{width:100%;border-collapse:collapse;margin:3mm 0 5mm;table-layout:fixed} thead{display:table-header-group}
tr{break-inside:avoid} th,td{padding:2mm;text-align:left;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap;border-bottom:1px solid #d5dfe2}
th{color:#1d5260;border-bottom:1.5px solid #1d5260;font-size:9pt}
.toc{padding-left:8mm;margin:10mm 0} .toc li{padding:2mm 0;border-bottom:1px solid #d5dfe2} a{color:#1d5260}
</style>
<section class="cover"><div class="eyebrow">Vertraulich · Finanzierungsunterlage</div>
<h1>Bankmappe</h1><div class="property">${e(project.name)}</div>
<p>${e(project.street + " " + project.houseNumber + " · " + project.postalCode + " " + project.city)}</p>
<dl><dt>Berichtsstand</dt><dd>${e(date(payload.on))}</dd><dt>Berichtsversion</dt><dd>${version}</dd><dt>Kaufpreis</dt><dd>${e(euro(project.purchasePrice))}</dd></dl>
<p class="muted">Planungsunterlage zur Prüfung. Eine Finanzierungszusage setzt eine eigenständige Entscheidung des Kreditgebers voraus.</p>
</section>
<section class="page"><div class="eyebrow">Wegweiser</div><h1>Inhaltsverzeichnis</h1><ol class="toc">
${payload.sections.map((key) => `<li><a href="#${key}">${e(bankSections[key])}</a></li>`).join("")}</ol>
<h2>Herkunft der Angaben</h2>
<p>Belegt · Ein zugeordneter Nachweis ist im Anlagenverzeichnis referenziert. Die Zuordnung stammt vom Nutzer und ersetzt keine fachliche Prüfung.</p>
<p>Vom Nutzer angegeben · Erfasste Angaben ohne direkten Belegbezug. Geschätzt · Plan- oder Annahmewerte. Berechnet · Aus gespeicherten Eingaben abgeleitete Werte.</p>
</section>
${payload.sections.map((key, index) => `<section class="page" id="${key}"><div class="eyebrow">Bankmappe · Version ${version} · Kapitel ${index + 1}</div><h1>${e(bankSections[key])}</h1>${chapters[key]()}</section>`).join("")}</html>`;
}
