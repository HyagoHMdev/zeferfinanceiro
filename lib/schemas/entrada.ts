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
    // Parcela desta entrada destinada à Zefer Joinville (carteira separada).
    percentual_joinville: z.number().min(0).max(1).default(0),
    venda_id: z.string().uuid().nullable(),
  })
  .refine(
    (d) =>
      Math.abs(d.percentual_empresa + d.percentual_pessoal + d.percentual_joinville - 1) < 0.0001,
    {
      message: "A soma de Empresa + Pessoal + Zefer Joinville deve dar exatamente 100%.",
      path: ["percentual_joinville"],
    },
  );

export type EntradaInput = z.infer<typeof entradaSchema>;
