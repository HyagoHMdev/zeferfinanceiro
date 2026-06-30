import { describe, it, expect } from "vitest";
import { resolverPercentualMensal, percentualComFallback } from "./percentuais";
import type { PercentualMensal } from "./types";

const rows: PercentualMensal[] = [
  {
    id: "1",
    chave: "comissao_corretor",
    entidade_id: "corr-1",
    competencia: "2026-06-01",
    percentual: 0.02,
    created_at: "",
  },
  {
    id: "2",
    chave: "dizimo",
    entidade_id: null,
    competencia: "2026-06-01",
    percentual: 0.1,
    created_at: "",
  },
];

describe("resolverPercentualMensal", () => {
  it("acha o valor do mês para a entidade", () => {
    expect(resolverPercentualMensal(rows, "comissao_corretor", "corr-1", "2026-06-15")).toBe(0.02);
  });
  it("retorna null quando o mês não tem valor", () => {
    expect(resolverPercentualMensal(rows, "comissao_corretor", "corr-1", "2026-07-15")).toBeNull();
  });
  it("acha valor global (entidade null)", () => {
    expect(resolverPercentualMensal(rows, "dizimo", null, "2026-06-02")).toBe(0.1);
  });
});

describe("percentualComFallback", () => {
  it("usa o mensal quando existe", () => {
    expect(
      percentualComFallback(rows, "comissao_corretor", "corr-1", "2026-06-10", 0.0175, 0.0175),
    ).toBe(0.02);
  });
  it("cai no fallback do cadastro quando o mês não tem valor", () => {
    expect(
      percentualComFallback(rows, "comissao_corretor", "corr-1", "2026-07-10", 0.0175, 0.015),
    ).toBe(0.0175);
  });
  it("pula fallbacks nulos", () => {
    expect(
      percentualComFallback(rows, "comissao_corretor", "corr-1", "2026-07-10", null, 0.013),
    ).toBe(0.013);
  });
});
