import { z } from "zod";

/**
 * Schema de entrada de uma venda (percentuais já em fração: 5% → 0.05).
 *
 * A comissão do corretor é editável aqui E no módulo Corretores: ela sai do
 * padrão do cadastro dele, mas varia em caso específico (venda dividida,
 * condição negociada), e quem lança a venda precisa poder ajustar na hora, sem
 * ter de lembrar de abrir outra tela depois. O resto da cadeia do corretor
 * (imposto de NF, desconto de parceria) segue só no módulo Corretores.
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
  // Ausente = mantém o que já estava na venda (ou o padrão do cadastro, na
  // criação). Só entra na conta quando vem preenchido de propósito.
  percentual_corretor: z.number().min(0).max(1).optional(),
  // Construtora libera a comissão mês a mês, conforme o cliente paga. Com isso
  // ligado, o repasse do investidor vira um lançamento por parcela.
  recebimento_parcelado: z.boolean().optional(),
  parcelas: z
    .array(
      z.object({
        numero: z.number().int().min(1),
        vencimento: z.string().min(1),
        valor: z.number().nonnegative(),
        recebido_em: z.string().nullable().optional(),
      }),
    )
    .max(120, "Máximo de 120 parcelas.")
    .optional(),
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
  // Caminho no bucket privado `contratos`, não URL: em bucket privado o link é
  // assinado e expira, então guardar a URL deixaria o contrato inacessível
  // depois de algumas horas.
  contrato_path: z.string().trim().max(400).nullable().optional(),
  // Documentos do cliente: caminho + nome original, para a lista não virar um
  // monte de UUID sem sentido.
  documentos: z
    .array(
      z.object({
        path: z.string().trim().min(1).max(400),
        nome: z.string().trim().max(200),
      }),
    )
    .max(20, "Máximo de 20 documentos por venda.")
    .optional(),
});

export type VendaInput = z.infer<typeof vendaSchema>;
