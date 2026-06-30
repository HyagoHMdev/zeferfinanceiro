import { describe, it, expect } from "vitest";
import {
  round2,
  calcularComissao,
  calcularDistribuicao,
  calcularSaldoCorretor,
} from "./calculos";

describe("round2", () => {
  it("arredonda half away from zero como o Excel", () => {
    expect(round2(7556.325)).toBe(7556.33);
    expect(round2(3778.1625)).toBe(3778.16); // .25 < .5 → para baixo
    expect(round2(2119.5491625)).toBe(2119.55);
    expect(round2(-9034.6660125)).toBe(-9034.67);
  });
});

describe("calcularComissao — venda Rogga/Evolution (teste de aceite das planilhas)", () => {
  const resultado = calcularComissao({
    vgv: 431790,
    percentualComissao: 0.05,
    percentualParceiro: 0.175,
    percentualImpostoImobiliaria: 0.119,
    percentualCorretor: 0.0175,
    percentualImpostoNf: 0.119,
  });

  it("reproduz toda a cadeia ao centavo", () => {
    expect(resultado.comissaoBruta).toBe(21589.5);
    expect(resultado.valorParceiro).toBe(3778.16);
    expect(resultado.saldoPosParceiro).toBe(17811.34);
    expect(resultado.valorImposto).toBe(2119.55);
    expect(resultado.liquidoZefer).toBe(15691.79);
    expect(resultado.comissaoCorretorBruto).toBe(7556.33);
    expect(resultado.valorImpostoNf).toBe(899.2);
    expect(resultado.liquidoCorretor).toBe(6657.12);
    expect(resultado.lucroLiquido).toBe(9034.67);
  });
});

describe("calcularComissao — sem parceiro", () => {
  it("zera o repasse e mantém o saldo igual à comissão bruta", () => {
    const r = calcularComissao({
      vgv: 100000,
      percentualComissao: 0.05,
      percentualImpostoImobiliaria: 0.119,
      percentualCorretor: 0.0175,
      percentualImpostoNf: 0.119,
    });
    expect(r.comissaoBruta).toBe(5000);
    expect(r.valorParceiro).toBe(0);
    expect(r.saldoPosParceiro).toBe(5000);
  });
});

describe("calcularDistribuicao", () => {
  it("sem dízimo distribui empresa/pessoal sobre o valor cheio", () => {
    const r = calcularDistribuicao({ valor: 50763.42, percentualDizimo: 0, percentualEmpresa: 0.1 });
    expect(r.valorDizimo).toBe(0);
    expect(r.liquido).toBe(50763.42);
    expect(r.valorEmpresa).toBe(5076.34);
    expect(r.valorPessoal).toBe(45687.08);
  });

  it("com dízimo de 10% desconta antes de distribuir", () => {
    const r = calcularDistribuicao({ valor: 1000, percentualDizimo: 0.1, percentualEmpresa: 0.2 });
    expect(r.valorDizimo).toBe(100);
    expect(r.liquido).toBe(900);
    expect(r.valorEmpresa).toBe(180);
    expect(r.valorPessoal).toBe(720);
  });
});

describe("calcularSaldoCorretor", () => {
  it("soma comissões e bonificações e desconta adiantamentos", () => {
    expect(
      calcularSaldoCorretor({ comissoesAReceber: 6657.12, bonificacoes: 500, adiantamentos: 1075.42 }),
    ).toBe(6081.7);
  });
});
