import { z } from "zod";

export const entradaSchema = z
  .object({
    data: z.string().min(1, "Informe a data"),
    tipo: z.enum([
      "comissao",
      "bonificacao",
      "premiacao",
      "investidor",
      "outras",
    ]),
    descricao: z.string().trim().max(200).nullable(),
    valor: z.number().positive("Valor inválido"),
    percentual_dizimo: z.number().min(0).max(1),
    percentual_empresa: z.number().min(0).max(1),
    percentual_pessoal: z.number().min(0).max(1),
    venda_id: z.string().uuid().nullable(),
    // "joinville" manda 100% do líquido para a Zefer Joinville (sem split).
    escopo: z.enum(["empresa", "joinville"]).default("empresa"),
  })
  .refine(
    // O split empresa/pessoal só precisa fechar 100% no escopo "empresa".
    (d) => d.escopo === "joinville" || Math.abs(d.percentual_empresa + d.percentual_pessoal - 1) < 0.0001,
    {
      message: "A distribuição entre Empresa e Pessoal deve totalizar exatamente 100%.",
      path: ["percentual_pessoal"],
    },
  );

export type EntradaInput = z.infer<typeof entradaSchema>;
