import { z } from "zod";

/**
 * Entrada da empresa.
 *
 * Não reparte mais percentual entre carteiras: toda entrada é 100% da empresa.
 * O que sai para o sócio virou uma SAÍDA registrada (categoria "Retirada"), e
 * não um pedaço escondido dentro da entrada. O dízimo continua, porque é
 * dedução do valor, não divisão de carteira.
 */
export const entradaSchema = z.object({
  data: z.string().min(1, "Informe a data"),
  tipo: z.enum(["comissao", "bonificacao", "premiacao", "investidor", "outras"]),
  descricao: z.string().trim().max(200).nullable(),
  valor: z.number().positive("Valor inválido"),
  percentual_dizimo: z.number().min(0).max(1),
  venda_id: z.string().uuid().nullable(),
});

export type EntradaInput = z.infer<typeof entradaSchema>;
