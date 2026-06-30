import { z } from "zod";

export const entradaSchema = z.object({
  data: z.string().min(1, "Informe a data"),
  tipo: z.enum(["comissao", "bonificacao", "premiacao", "outras"]),
  descricao: z.string().trim().max(200).nullable(),
  valor: z.number().positive("Valor inválido"),
  percentual_dizimo: z.number().min(0).max(1),
  venda_id: z.string().uuid().nullable(),
});

export type EntradaInput = z.infer<typeof entradaSchema>;
