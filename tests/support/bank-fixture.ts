import { PDFDocument, degrees } from "pdf-lib";
import { saveLoan, saveProject, saveScenario } from "../../src/modules/acquisition/service";
import { loanInput, projectInput, scenarioInput } from "../../src/modules/acquisition/validation";
import { getDb } from "../../src/lib/db";
import { storeDocument } from "../../src/modules/documents/service";

export const syntheticProject = (name: string) => projectInput.parse({
  name, street: "Testweg", houseNumber: "1", postalCode: "00000", city: "Testort", state: "HE", type: "MULTI_FAMILY",
  builtYear: "1992", landArea: "340", livingArea: "125", purchaseDate: "", purchasePrice: "100000", description: "Synthetisches Zweifamilienhaus.",
  expectedAnnualRent: "12000", vacancyRate: "5", condition: "Gepflegt", renovationNotes: "Fassade prüfen.",
});
export const syntheticAssumptions = {
  assumptionsOn: "2026-11-09", source: "Synthetische Annahmen", transferTaxRate: "6", notaryRate: "1,5",
  registryRate: "0,5", brokerRate: "0", renovation: "5000", otherCosts: "0", reserve: "2000", equity: "40000",
  annualRent: "12000", vacancyRate: "5", lossRate: "2", ownerCosts: "1000", maintenance: "1200",
};

export async function bankFixture(actor: string, name: string) {
  const id = crypto.randomUUID();
  const project = syntheticProject(name);
  await saveProject(actor, id, project);
  for (const [index, kind] of (["BASE", "CONSERVATIVE", "OPTIMISTIC"] as const).entries()) {
    await saveScenario(actor, id, index, scenarioInput.parse({ ...syntheticAssumptions, kind, vacancyRate: String(5 + index * 3) }));
  }
  const base = await getDb().acquisitionScenario.findFirstOrThrow({ where: { projectId: id, kind: "BASE" } });
  await saveLoan(actor, id, base.id, 3, loanInput.parse({
    id: crypto.randomUUID(), label: "Synthetisches Darlehen", principal: "60000", annualRate: "3", initialRepayment: "2",
    fixedMonths: "14", refinancesId: "", extras: "12;1000",
  }));
  const form = new FormData();
  form.set("acquisitionProjectId", id);
  form.set("type", "EXPOSE");
  form.set("description", "Synthetischer Nachweis");
  const document = await PDFDocument.create();
  const page = document.addPage([480, 620]);
  page.setRotation(degrees(90));
  page.drawText("Synthetischer Originalnachweis", { x: 40, y: 500 });
  const bytes = Buffer.from(await document.save());
  form.set("file", new File([new Uint8Array(bytes)], "test-expose.pdf", { type: "application/pdf" }));
  const documentId = await storeDocument(actor, form);
  return { id, project, documentId, bytes };
}
