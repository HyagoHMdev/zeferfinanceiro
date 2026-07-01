import { z } from "zod";

/**
 * Schema de entrada de uma venda (percentuais já em fração: 5% → 0.05).
 * Os percentuais do corretor NÃO fazem parte do formulário de venda — são
 * geridos no módulo Corretores. Aqui ficam só os dados e a cadeia da imobiliária.
 */
export const vendaSchema = z.object({
  data_venda: z.string().min(1, "Informe a data da venda"),
  construtora_id: z.string().uuid().nullable(),
  empreendimento_id: z.string().uuid().nullable(),
  unidade: z.string().trim().max(120).nullable(),
  torre: z.string().trim().max(80).nullable(),
  cliente: z.string().trim().max(200).nullable(),
  cliente_nascimento: z.string().nullable(),
  cliente_telefone: z.string().trim().max(40).nullable(),
  corretor_id: z.string().uuid().nullable(),
  // Parceria (modelo manual)
  possui_parceria: z.boolean(),
  empresa_parceira: z.string().trim().max(200).nullable(),
  percentual_parceria: z.number().min(0).max(1),
  // Valores / imobiliária
  vgv: z.number().nonnegative("VGV inválido"),
  percentual_comissao: z.number().min(0).max(1),
  percentual_imposto_imobiliaria: z.number().min(0).max(1),
  observacoes: z.string().trim().max(1000).nullable(),
});

export type VendaInput = z.infer<typeof vendaSchema>;
