import { z } from "zod";

/** Schema de entrada de uma venda (percentuais já em fração: 5% → 0.05). */
export const vendaSchema = z.object({
  data_venda: z.string().min(1, "Informe a data da venda"),
  construtora_id: z.string().uuid().nullable(),
  empreendimento_id: z.string().uuid().nullable(),
  unidade: z.string().trim().max(120).nullable(),
  cliente: z.string().trim().max(200).nullable(),
  corretor_id: z.string().uuid().nullable(),
  parceiro_id: z.string().uuid().nullable(),
  vgv: z.number().nonnegative("VGV inválido"),
  percentual_comissao: z.number().min(0).max(1),
  percentual_parceiro: z.number().min(0).max(1),
  percentual_imposto_imobiliaria: z.number().min(0).max(1),
  percentual_corretor: z.number().min(0).max(1),
  percentual_imposto_nf: z.number().min(0).max(1),
  observacoes: z.string().trim().max(1000).nullable(),
});

export type VendaInput = z.infer<typeof vendaSchema>;
