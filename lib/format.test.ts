import { describe, it, expect } from "vitest";
import { vencimentoDaCompetencia } from "./format";

describe("vencimentoDaCompetencia", () => {
  it("mantém o dia base quando existe no mês", () => {
    expect(vencimentoDaCompetencia(3, "2026-06-01")).toBe("2026-06-03");
    expect(vencimentoDaCompetencia(3, "2026-07")).toBe("2026-07-03");
  });

  it("clampa para o último dia quando o dia não existe (fev)", () => {
    expect(vencimentoDaCompetencia(31, "2026-02-01")).toBe("2026-02-28");
    expect(vencimentoDaCompetencia(31, "2024-02-01")).toBe("2024-02-29"); // bissexto
  });

  it("clampa dia 31 em meses de 30 dias", () => {
    expect(vencimentoDaCompetencia(31, "2026-04-01")).toBe("2026-04-30");
  });
});
