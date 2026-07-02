import { describe, it, expect } from "vitest";
import {
  round2,
  calcularVenda,
  resumoCorretor,
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

describe("calcularVenda — parceria sobre o VGV (base = VGV)", () => {
  const r = calcularVenda({
    vgv: 431790,
    percentualComissao: 0.05,
    possuiParceria: true,
    percentualParceria: 0.01, // 1% do VGV
    percentualImpostoImobiliaria: 0.119,
    percentualCorretor: 0.0175,
    percentualDescontoParceiro: 0,
    percentualImpostoNf: 0.119,
  });
  it("calcula o valor da parceria sobre o VGV e a cadeia ao centavo", () => {
    expect(r.comissaoBruta).toBe(21589.5);
    expect(r.valorParceria).toBe(4317.9); // 431790 × 1%
    expect(r.liquidoPosParceria).toBe(17271.6);
    expect(r.valorImposto).toBe(2055.32);
    expect(r.liquidoZefer).toBe(15216.28);
    expect(r.comissaoCorretorBruto).toBe(7556.33);
    expect(r.valorImpostoNf).toBe(899.2);
    expect(r.liquidoCorretor).toBe(6657.12);
    expect(r.lucroLiquido).toBe(8559.16);
  });
});

describe("calcularVenda — sem parceria e com desconto do corretor", () => {
  it("sem parceria: líquido pós-parceria = comissão bruta", () => {
    const r = calcularVenda({
      vgv: 100000,
      percentualComissao: 0.05,
      possuiParceria: false,
      percentualParceria: 0.3,
      percentualImpostoImobiliaria: 0.119,
      percentualCorretor: 0.0175,
      percentualImpostoNf: 0.119,
    });
    expect(r.valorParceria).toBe(0);
    expect(r.liquidoPosParceria).toBe(5000);
    expect(r.comissaoCorretorBruto).toBe(1750);
    expect(r.descontoCorretor).toBe(0);
  });

  it("com parceria: desconto reduz a comissão do corretor", () => {
    const r = calcularVenda({
      vgv: 100000,
      percentualComissao: 0.05,
      possuiParceria: true,
      percentualParceria: 0.2,
      percentualImpostoImobiliaria: 0.119,
      percentualCorretor: 0.02,
      percentualDescontoParceiro: 0.5,
      percentualImpostoNf: 0.1,
    });
    // comissão corretor bruta = 2000; desconto 50% = 1000; ajustada = 1000
    expect(r.comissaoCorretorBruto).toBe(2000);
    expect(r.descontoCorretor).toBe(1000);
    expect(r.comissaoCorretorAjustada).toBe(1000);
    expect(r.valorImpostoNf).toBe(100);
    expect(r.liquidoCorretor).toBe(900);
  });
});

describe("resumoCorretor", () => {
  it("desconta adiantamentos do líquido do corretor", () => {
    expect(resumoCorretor(6657.12, 1075.42)).toBe(5581.7);
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
