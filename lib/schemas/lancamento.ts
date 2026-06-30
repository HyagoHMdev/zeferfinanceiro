import { z } from "zod";

export const lancamentoSchema = z.object({
  escopo: z.enum(["empresa", "pessoal"]),
  natureza: z.enum([
    "custo_fixo",
    "despesa_variavel",
    "investimento",
    "entrada_pessoal",
    "saida_pessoal",
  ]),
  categoria_id: z.string().uuid().nullable(),
  descricao: z.string().trim().min(1, "Informe a descrição").max(200),
  valor: z.number().positive("Valor inválido"),
  /** Mês de competência no formato YYYY-MM (1º dia é assumido). */
  competencia: z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido"),
  data_vencimento: z.string().nullable(),
  status: z.enum(["pago", "pendente", "atrasado"]),
  recorrencia: z.enum(["nenhuma", "mensal", "anual"]),
  /** Quantas ocorrências gerar (1 = apenas o mês informado). */
  repeticoes: z.number().int().min(1).max(60),
  conta_id: z.string().uuid().nullable(),
  centro_custo_id: z.string().uuid().nullable(),
  fornecedor_id: z.string().uuid().nullable(),
  anexo_url: z.string().nullable(),
});

export type LancamentoInput = z.infer<typeof lancamentoSchema>;
