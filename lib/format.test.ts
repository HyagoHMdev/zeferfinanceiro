import { describe, it, expect } from "vitest";
import { vencimentoDaCompetencia, ordenarMeses } from "./format";

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

describe("ordenarMeses", () => {
  const hoje = new Date("2026-08-20T12:00:00Z");

  it("põe o mês atual primeiro, depois o futuro em ordem", () => {
    const r = ordenarMeses(["2031-07", "2026-09", "2026-08", "2026-10"], hoje);
    expect(r.slice(0, 3)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(r.at(-1)).toBe("2031-07");
  });

  it("passado vem depois do futuro, do mais recente para o mais antigo", () => {
    const r = ordenarMeses(["2026-05", "2026-07", "2026-08", "2026-09"], hoje);
    expect(r).toEqual(["2026-08", "2026-09", "2026-07", "2026-05"]);
  });

  it("só passado: o mais recente encabeça", () => {
    expect(ordenarMeses(["2026-05", "2026-07"], hoje)).toEqual(["2026-07", "2026-05"]);
  });
});
