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
  cliente_cpf: z.string().trim().max(20).nullable(),
  // De onde veio o cliente (canal + complemento livre).
  origem: z.string().trim().max(60).nullable(),
  origem_detalhe: z.string().trim().max(200).nullable(),
  // Perfil do comprador.
  cliente_finalidade: z.string().trim().max(30).nullable(),
  cliente_profissao: z.string().trim().max(120).nullable(),
  cliente_cidade: z.string().trim().max(120).nullable(),
  cliente_estado: z.string().trim().max(2).nullable(),
  cliente_email: z.string().trim().max(200).nullable(),
  // Investidores que participam desta venda (ids de public.investidores).
  investidores: z.array(z.string().uuid()).optional(),
  corretor_id: z.string().uuid().nullable(),
  // Parceria (parceiro do cadastro)
  possui_parceria: z.boolean(),
  parceiro_id: z.string().uuid().nullable(),
  empresa_parceira: z.string().trim().max(200).nullable(),
  percentual_parceria: z.number().min(0).max(1),
  // Valores / imobiliária
  vgv: z.number().nonnegative("VGV inválido"),
  percentual_comissao: z.number().min(0).max(1),
  percentual_imposto_imobiliaria: z.number().min(0).max(1),
  // 2000 e não 1000: observação é campo de texto corrido (condições combinadas,
  // pendências) e o limite antigo cortava um parágrafo mais longo.
  observacoes: z
    .string()
    .trim()
    .max(2000, "A observação passou de 2000 caracteres.")
    .nullable(),
});

export type VendaInput = z.infer<typeof vendaSchema>;
