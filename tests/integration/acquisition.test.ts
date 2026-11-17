import { afterAll, expect, it } from "vitest";
import { getDb } from "../../src/lib/db";
import { berlinToday } from "../../src/modules/stammdaten/calendar";
import { archiveLoan, convertProject, projectDetail, saveLoan, saveProject, saveScenario } from "../../src/modules/acquisition/service";
import { loanInput, projectInput, scenarioInput } from "../../src/modules/acquisition/validation";
import { acquisitionScenario } from "../../src/modules/acquisition/calculation";
import { storeDocument } from "../../src/modules/documents/service";
import { masterDataFixture } from "../support/master-data-fixture";

const db = getDb();
afterAll(() => db.$disconnect());

it("speichert Annahmen, Darlehen und Exposé und übernimmt das Kaufobjekt einmalig", async () => {
  const user = await masterDataFixture();
  try {
    const id = crypto.randomUUID();
    const day = berlinToday();
    const project = projectInput.parse({ name: user.prefix, street: "Testweg", houseNumber: "1", postalCode: "00000", city: "Testort",
      state: "HE", type: "MULTI_FAMILY", builtYear: "", landArea: "", livingArea: "90", purchaseDate: "", purchasePrice: "100000",
      description: "", expectedAnnualRent: "12000", vacancyRate: "5", condition: "Synthetisch", renovationNotes: "" });
    await saveProject(user.id, id, project);
    const assumption = { assumptionsOn: day.toISOString().slice(0, 10), source: "Synthetische Annahmen", transferTaxRate: "6", notaryRate: "1,5",
      registryRate: "0,5", brokerRate: "0", renovation: "5000", otherCosts: "0", reserve: "2000", equity: "40000",
      annualRent: "12000", vacancyRate: "5", lossRate: "2", ownerCosts: "1000", maintenance: "1200" };
    await saveScenario(user.id, id, 0, scenarioInput.parse({ ...assumption, kind: "BASE" }));
    await saveScenario(user.id, id, 1, scenarioInput.parse({ ...assumption, kind: "CONSERVATIVE", vacancyRate: "15" }));
    await saveScenario(user.id, id, 2, scenarioInput.parse({ ...assumption, kind: "OPTIMISTIC", vacancyRate: "0" }));
    const base = await db.acquisitionScenario.findFirstOrThrow({ where: { projectId: id, kind: "BASE" } });
    const loanId = crypto.randomUUID(), refinanceId = crypto.randomUUID(), discardedId = crypto.randomUUID();
    const loan = { id: loanId, label: "Testdarlehen", principal: "60000", annualRate: "0", initialRepayment: "12", fixedMonths: "12", refinancesId: "", extras: "1;1000" };
    await saveLoan(user.id, id, base.id, 3, loanInput.parse(loan));
    await saveLoan(user.id, id, base.id, 4, loanInput.parse({ ...loan, id: refinanceId, label: "Anschluss", principal: "", refinancesId: loanId, extras: "" }));
    await saveLoan(user.id, id, base.id, 5, loanInput.parse({ ...loan, id: discardedId, label: "Verworfener Entwurf" }));
    await archiveLoan(user.id, id, discardedId, 6);
    const saved = await projectDetail(id);
    const result = saved!.scenarios.find((item) => item.kind === "BASE")!;
    expect(result.loans).toHaveLength(2);
    expect(result.loans[1]).toMatchObject({ startsMonth: 13, refinancesId: loanId });
    expect(result.loans[1].principal.toFixed(2)).toBe("51800.00");
    expect(acquisitionScenario(saved!.purchasePrice, result, result.loans).financed.toFixed(2)).toBe("60000.00");

    const form = new FormData();
    form.set("acquisitionProjectId", id); form.set("type", "EXPOSE"); form.set("description", "Synthetisch");
    form.set("file", new File(["%PDF-1.4\nsynthetisch\n%%EOF\n"], "test-expose.pdf", { type: "application/pdf" }));
    const document = await storeDocument(user.id, form);
    expect(await db.document.findUnique({ where: { id: document } })).toMatchObject({ acquisitionProjectId: id, propertyId: null, type: "EXPOSE" });

    const transfers = await Promise.all([convertProject(user.id, id, 7, day), convertProject(user.id, id, 7, day)]);
    expect(transfers[0]).toBe(transfers[1]);
    expect(await db.property.findUnique({ where: { id: transfers[0] } })).toMatchObject({ name: user.prefix, purchaseDate: day });
    expect((await projectDetail(id))?.scenarios).toHaveLength(3);
    await expect(saveProject(user.id, id, project, 8)).rejects.toThrow("inzwischen geändert");
    await expect(storeDocument(user.id, form)).rejects.toThrow("archiviert");
  } finally { await user.dispose(); }
});
