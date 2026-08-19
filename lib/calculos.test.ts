import { describe, it, expect } from "vitest";
import {
  round2,
  calcularVenda,
  resumoCorretor,
  calcularDistribuicao,
  calcularSaldoCorretor,
  ratearPorParcelas,
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
    expect(r.descontoCorretor).toBe(0); // parceria sai toda da imobiliária
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

  // O desconto de parceria virou VALOR em reais (era percentual). O percentual
  // continua atendido para vendas antigas, que só têm ele gravado.
  const comParceria = {
    vgv: 500000,
    percentualComissao: 0.05,
    possuiParceria: true,
    percentualParceria: 0,
    percentualImpostoImobiliaria: 0,
    percentualCorretor: 0.02, // comissão bruta do corretor = 10.000
    percentualImpostoNf: 0,
  };

  it("desconto em reais entra pelo valor informado", () => {
    const r = calcularVenda({ ...comParceria, descontoParceiroValor: 1500 });
    expect(r.comissaoCorretorBruto).toBe(10000);
    expect(r.descontoCorretor).toBe(1500);
    expect(r.liquidoCorretor).toBe(8500);
  });

  it("desconto não passa da comissão bruta do corretor", () => {
    const r = calcularVenda({ ...comParceria, descontoParceiroValor: 99999 });
    expect(r.descontoCorretor).toBe(10000);
    expect(r.liquidoCorretor).toBe(0);
  });

  it("desconto negativo é tratado como zero", () => {
    const r = calcularVenda({ ...comParceria, descontoParceiroValor: -50 });
    expect(r.descontoCorretor).toBe(0);
  });

  it("sem parceria o desconto é ignorado", () => {
    const r = calcularVenda({
      ...comParceria,
      possuiParceria: false,
      descontoParceiroValor: 1500,
    });
    expect(r.descontoCorretor).toBe(0);
    expect(r.liquidoCorretor).toBe(10000);
  });

  it("venda antiga (só percentual) continua calculando igual", () => {
    const r = calcularVenda({ ...comParceria, percentualDescontoParceiro: 0.1 });
    expect(r.descontoCorretor).toBe(1000);
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

describe("ratearPorParcelas", () => {
  it("divide pelo peso de cada parcela", () => {
    expect(ratearPorParcelas(3000, [20000, 15000, 15000])).toEqual([1200, 900, 900]);
  });

  it("fecha o total mesmo quando a divisão não é exata", () => {
    const fatias = ratearPorParcelas(1000, [1, 1, 1]);
    expect(fatias).toEqual([333.33, 333.33, 333.34]);
    expect(round2(fatias.reduce((s, f) => s + f, 0))).toBe(1000);
  });

  it("parcela única leva tudo", () => {
    expect(ratearPorParcelas(1234.56, [500])).toEqual([1234.56]);
  });

  it("sem parcela, ou com parcelas zeradas, não inventa valor", () => {
    expect(ratearPorParcelas(1000, [])).toEqual([]);
    expect(ratearPorParcelas(1000, [0, 0])).toEqual([0, 0]);
  });
});

describe("parceria não desconta o corretor", () => {
  const base = {
    vgv: 1_000_000,
    percentualComissao: 0.05,
    possuiParceria: true,
    percentualParceria: 0.01, // R$ 10.000 de parceria
    percentualImpostoImobiliaria: 0,
    percentualCorretor: 0.3,
    percentualImpostoNf: 0,
  };

  it("a parceria sai inteira da imobiliária", () => {
    const r = calcularVenda(base);
    expect(r.valorParceria).toBe(10_000);
    expect(r.descontoCorretor).toBe(0);
    expect(r.comissaoCorretorAjustada).toBe(r.comissaoCorretorBruto);
  });

  it("valor digitado à mão continua descontando", () => {
    const r = calcularVenda({ ...base, descontoParceiroValor: 1_500 });
    expect(r.descontoCorretor).toBe(1_500);
  });

  it("venda antiga com percentual legado segue pelo percentual", () => {
    const r = calcularVenda({ ...base, percentualDescontoParceiro: 0.1 });
    expect(r.descontoCorretor).toBe(30_000);
  });

  it("sem parceria não há desconto", () => {
    expect(calcularVenda({ ...base, possuiParceria: false }).descontoCorretor).toBe(0);
  });
});
