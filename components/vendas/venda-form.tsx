"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { calcularVenda, round2 } from "@/lib/calculos";
import { parseNumeroBR, formatBRL, formatarCpf } from "@/lib/format";
import { percentualComFallback } from "@/lib/percentuais";
import { criarVenda, atualizarVenda } from "@/app/(app)/vendas/actions";
import { ContratoUpload } from "@/components/contrato-upload";
import { DocumentosUpload, type DocumentoVenda } from "@/components/documentos-upload";
import type { VendaInput } from "@/lib/schemas/venda";
import type { ChecklistPendente } from "@/lib/data/checklist";
import type {
  Configuracoes,
  Venda,
  Construtora,
  Empreendimento,
  Corretor,
  Parceiro,
  PercentualMensal,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResumoLinha } from "@/components/resumo-linha";

const NONE = "__none__";

function fracaoParaPctStr(f: number | null | undefined): string {
  if (f === null || f === undefined) return "";
  return (Math.round(f * 1e6) / 1e4).toString();
}
function pctToFrac(str: string): number {
  return parseNumeroBR(str) / 100;
}

// Canais de aquisição. Texto no banco (não enum): a lista muda com o tempo e
// enum exigiria migração a cada canal novo.
const ORIGENS = [
  "Instagram",
  "Anúncio (Meta Ads)",
  "Indicação",
  "Site / Landing page",
  "WhatsApp",
  "Carteira do corretor",
  "Portal (VivaReal, ZAP)",
  "Evento",
  "Parceria",
  "Outro",
] as const

// O Select do shadcn não aceita item de valor vazio, então "não informado"
// tem um valor próprio que vira null na gravação.
const SEM_ORIGEM = "__sem__"

const FINALIDADES = ["Moradia", "Investimento", "Veraneio"] as const

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB",
  "PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
] as const

const DICA_ORIGEM: Record<string, string> = {
  Indicação: "Quem indicou",
  "Portal (VivaReal, ZAP)": "Qual portal",
  Evento: "Qual evento",
  Parceria: "Qual parceiro",
  "Anúncio (Meta Ads)": "Qual campanha",
}

export interface InvestidorOpcao {
  id: string;
  nome: string;
  percentual: number;
  participa: boolean;
}

/**
 * O corretor digita construtora e empreendimento como texto livre; aqui eles
 * são listas cadastradas, com id. Sem casar os dois, aprovar uma submissão
 * abria o formulário com esses dois campos vazios, e quem aprova tinha que
 * adivinhar o que o corretor escreveu.
 *
 * A comparação ignora acento, caixa e espaço sobrando, que é justamente o que
 * separa "Rogga " de "rogga".
 */
const chaveNome = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

interface VendaFormProps {
  mode: "create" | "edit";
  config: Configuracoes;
  construtoras: Construtora[];
  empreendimentos: Empreendimento[];
  corretores: Corretor[];
  parceiros: Parceiro[];
  percentuaisMensais?: PercentualMensal[];
  investidores?: InvestidorOpcao[];
  venda?: Venda;
  /** Parcelas que a construtora vai liberar (quando a venda é parcelada). */
  parcelas?: ParcelaLinha[];
  /** Submissão do corretor sendo aprovada. Pré-preenche e fecha o checklist. */
  checklist?: ChecklistPendente | null;
}

export type ParcelaLinha = {
  numero: number;
  vencimento: string;
  valor: number;
  recebido_em: string | null;
};

export function VendaForm({
  mode,
  config,
  construtoras,
  empreendimentos,
  corretores,
  parceiros,
  percentuaisMensais = [],
  investidores = [],
  venda,
  parcelas: parcelasIniciais = [],
  checklist = null,
}: VendaFormProps) {
  // Quais investidores participam desta venda. O repasse (lucro × percentual)
  // entra sozinho como despesa variável assim que a venda é salva.
  const [investidoresSel, setInvestidoresSel] = useState<string[]>(
    investidores.filter((i) => i.participa).map((i) => i.id),
  );
  const [dataVenda, setDataVenda] = useState(
    venda?.data_venda ?? new Date().toISOString().slice(0, 10),
  );
  // Casa o texto do checklist com o cadastro. Só aceita acerto exato de nome:
  // um palpite por semelhança poderia lançar a venda na construtora errada, e
  // a comissão sai daí.
  const doChecklist = useMemo(() => {
    if (!checklist) return { construtoraId: null, empreendimentoId: null };
    const c = construtoras.find((x) => chaveNome(x.nome) === chaveNome(checklist.construtora));
    const candidatos = empreendimentos.filter(
      (e) => chaveNome(e.nome) === chaveNome(checklist.empreendimento),
    );
    // Preferência para o da construtora reconhecida; senão, o único candidato,
    // inclusive quando ele está sem construtora vinculada. Com mais de um
    // homônimo e nenhum da construtora certa, não escolhe: lançar na
    // construtora errada mexe na comissão.
    const e =
      (c ? candidatos.find((x) => x.construtora_id === c.id) : undefined) ??
      (candidatos.length === 1 ? candidatos[0] : undefined);
    return { construtoraId: c?.id ?? null, empreendimentoId: e?.id ?? null };
  }, [checklist, construtoras, empreendimentos]);

  const [construtoraId, setConstrutoraId] = useState(
    venda?.construtora_id ?? doChecklist.construtoraId ?? NONE,
  );
  const [empreendimentoId, setEmpreendimentoId] = useState(
    venda?.empreendimento_id ?? doChecklist.empreendimentoId ?? NONE,
  );
  const [unidade, setUnidade] = useState(venda?.unidade ?? checklist?.unidade ?? "");
  const [torre, setTorre] = useState(venda?.torre ?? checklist?.torre ?? "");
  const [cliente, setCliente] = useState(venda?.cliente ?? checklist?.clienteNome ?? "");
  const [clienteNascimento, setClienteNascimento] = useState(
    venda?.cliente_nascimento ?? checklist?.clienteNascimento ?? "",
  );
  // O checklist guarda só os dígitos; aqui o campo é mascarado, então o valor
  // vindo de lá entra já formatado, senão apareceria "12345678900".
  const [clienteCpf, setClienteCpf] = useState(
    venda?.cliente_cpf ?? (checklist?.clienteCpf ? formatarCpf(checklist.clienteCpf) : ""),
  );
  const [origem, setOrigem] = useState(venda?.origem ?? checklist?.origem ?? "");
  const [origemDetalhe, setOrigemDetalhe] = useState(venda?.origem_detalhe ?? "");
  const [finalidade, setFinalidade] = useState(venda?.cliente_finalidade ?? checklist?.finalidade ?? "");
  const [profissao, setProfissao] = useState(venda?.cliente_profissao ?? "");
  const [clienteCidade, setClienteCidade] = useState(venda?.cliente_cidade ?? checklist?.clienteCidade ?? "");
  const [clienteEstado, setClienteEstado] = useState(venda?.cliente_estado ?? checklist?.clienteEstado ?? "");
  const [clienteEmail, setClienteEmail] = useState(venda?.cliente_email ?? checklist?.clienteEmail ?? "");
  const [clienteTelefone, setClienteTelefone] = useState(
    venda?.cliente_telefone ?? checklist?.clienteTelefone ?? "",
  );
  const [corretorId, setCorretorId] = useState(venda?.corretor_id ?? NONE);
  const [vgv, setVgv] = useState(venda ? String(venda.vgv) : checklist ? String(checklist.valorContrato) : "");

  const [possuiParceria, setPossuiParceria] = useState(
    venda?.possui_parceria ?? false,
  );
  const [parceiroId, setParceiroId] = useState(venda?.parceiro_id ?? NONE);
  const [empresaParceira, setEmpresaParceira] = useState(
    venda?.empresa_parceira ?? "",
  );
  const [pctParceria, setPctParceria] = useState(
    fracaoParaPctStr(venda?.percentual_parceria ?? 0),
  );

  const [pctComissao, setPctComissao] = useState(
    fracaoParaPctStr(venda?.percentual_comissao ?? config.percentual_comissao_padrao),
  );
  const [pctImpostoImob, setPctImpostoImob] = useState(
    fracaoParaPctStr(
      venda?.percentual_imposto_imobiliaria ?? config.percentual_imposto_imobiliaria,
    ),
  );
  const [observacoes, setObservacoes] = useState(venda?.observacoes ?? "");
  // Aprovando uma submissão, os arquivos que o CORRETOR anexou já entram na
  // venda. Os dois lados guardam no mesmo bucket ("contratos"), então é só
  // reaproveitar o caminho: nada é copiado nem re-enviado. Sem isto a venda
  // nascia sem anexo nenhum e os documentos ficavam presos no checklist.
  const doDocs = (rotulo: string) =>
    checklist?.docs.find((d) => d.rotulo === rotulo)?.arquivos ?? [];

  const [contratoPath, setContratoPath] = useState<string | null>(
    venda?.contrato_path ?? doDocs("Contrato")[0]?.path ?? null,
  );
  // Vem do banco como jsonb: pode chegar com formato antigo ou nulo, então a
  // leitura filtra em vez de confiar.
  const [documentos, setDocumentos] = useState<DocumentoVenda[]>(() => {
    if (Array.isArray(venda?.documentos)) {
      return (venda.documentos as DocumentoVenda[]).filter((d) => d?.path);
    }
    if (!checklist) return [];
    // Tudo que não é o contrato principal vira anexo da venda, com o rótulo do
    // checklist no nome para não virar uma lista de arquivos sem contexto.
    const contratoPrincipal = doDocs("Contrato")[0]?.path;
    return checklist.docs
      .flatMap((grupo) =>
        grupo.arquivos.map((a) => ({
          path: a.path,
          nome: `${grupo.rotulo} · ${a.nome}`,
        })),
      )
      .filter((d) => d.path && d.path !== contratoPrincipal);
  });
  const [saving, setSaving] = useState(false);

  // Empreendimento sem construtora vinculada aparece sempre. Antes ele sumia
  // ao escolher qualquer construtora, e o campo ficava impossível de
  // preencher: era o caso do Baía Azul, cadastrado solto.
  const empreendimentosFiltrados = useMemo(
    () =>
      empreendimentos.filter(
        (e) =>
          construtoraId === NONE ||
          e.construtora_id === construtoraId ||
          e.construtora_id === null,
      ),
    [empreendimentos, construtoraId],
  );

  // A cadeia do corretor (comissão, imposto de NF, desconto de parceria) é
  // editável aqui e no módulo Corretores. Os dois lados gravam nas mesmas
  // colunas da venda, então o que for salvo de um lado aparece no outro.
  const corretorSel = corretores.find((c) => c.id === corretorId);
  const corretorMudou = venda ? corretorId !== (venda.corretor_id ?? NONE) : true;
  const pctCorretorPadrao =
    venda && !corretorMudou
      ? venda.percentual_corretor
      : (corretorSel?.percentual_comissao_padrao ??
        config.percentual_comissao_corretor_padrao);
  const pctImpostoNfPreview =
    venda && !corretorMudou
      ? venda.percentual_imposto_nf
      : (corretorSel?.percentual_imposto_nf ??
        config.percentual_imposto_nf_corretor);
  const pctDescontoPreview =
    venda && !corretorMudou ? venda.percentual_desconto_parceiro : 0;

  // Recebimento parcelado pela construtora.
  const [parcelado, setParcelado] = useState(venda?.recebimento_parcelado ?? false);
  const [parcelas, setParcelas] = useState<ParcelaLinha[]>(parcelasIniciais);
  const [qtdGerar, setQtdGerar] = useState("12");
  const [primeiroVenc, setPrimeiroVenc] = useState(
    parcelasIniciais[0]?.vencimento ??
      new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10),
  );

  const somaParcelas = round2(parcelas.reduce((s, p) => s + p.valor, 0));

  /** Divide a comissão bruta em N parcelas mensais iguais (a última fecha). */
  function gerarParcelas() {
    const n = Math.max(1, Math.min(120, Math.floor(Number(qtdGerar) || 1)));
    const total = round2(calc.comissaoBruta);
    const base = Math.floor((total / n) * 100) / 100;
    const [ano, mes, dia] = primeiroVenc.split("-").map(Number);
    const novas: ParcelaLinha[] = Array.from({ length: n }, (_, i) => {
      const d = new Date(ano, mes - 1 + i, 1);
      const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(dia, ultimoDia));
      return {
        numero: i + 1,
        vencimento: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        // A última absorve o resto para a soma bater com a comissão bruta.
        valor: i === n - 1 ? round2(total - base * (n - 1)) : base,
        recebido_em: null,
      };
    });
    setParcelas(novas);
  }

  function editarParcela(idx: number, patch: Partial<ParcelaLinha>) {
    setParcelas((ps) => ps.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  // Campo editável da % do corretor. `null` = ainda não mexeram nesta sessão,
  // então segue o padrão (que muda sozinho ao trocar de corretor). Assim que o
  // usuário digita, o valor dele manda.
  const [pctCorretorEdit, setPctCorretorEdit] = useState<string | null>(null);
  const pctCorretorPreview =
    pctCorretorEdit === null ? pctCorretorPadrao : pctToFrac(pctCorretorEdit);

  const [pctImpostoNfEdit, setPctImpostoNfEdit] = useState<string | null>(null);
  const pctImpostoNfAtual =
    pctImpostoNfEdit === null ? pctImpostoNfPreview : pctToFrac(pctImpostoNfEdit);


  const calc = useMemo(
    () =>
      calcularVenda({
        vgv: parseNumeroBR(vgv),
        percentualComissao: pctToFrac(pctComissao),
        possuiParceria,
        percentualParceria: possuiParceria ? pctToFrac(pctParceria) : 0,
        percentualImpostoImobiliaria: pctToFrac(pctImpostoImob),
        percentualCorretor: pctCorretorPreview,
        percentualDescontoParceiro: pctDescontoPreview,
        percentualImpostoNf: pctImpostoNfAtual,
      }),
    [
      vgv,
      pctComissao,
      possuiParceria,
      pctParceria,
      pctImpostoImob,
      pctCorretorPreview,
      pctDescontoPreview,
      pctImpostoNfAtual,
    ],
  );

  function aplicarComissao(cId: string, d: string) {
    const c = construtoras.find((x) => x.id === cId);
    setPctComissao(
      fracaoParaPctStr(
        percentualComFallback(
          percentuaisMensais,
          "comissao_construtora",
          cId === NONE ? null : cId,
          d,
          c?.comissao_padrao,
          config.percentual_comissao_padrao,
        ),
      ),
    );
  }
  function aplicarImpostoImob(d: string) {
    setPctImpostoImob(
      fracaoParaPctStr(
        percentualComFallback(
          percentuaisMensais,
          "imposto_imobiliaria",
          null,
          d,
          config.percentual_imposto_imobiliaria,
        ),
      ),
    );
  }

  function onSelectConstrutora(value: string) {
    setConstrutoraId(value);
    setEmpreendimentoId(NONE);
    aplicarComissao(value, dataVenda);
  }
  function aplicarParceiro(pId: string, d: string) {
    const p = parceiros.find((x) => x.id === pId);
    setPctParceria(
      fracaoParaPctStr(
        percentualComFallback(
          percentuaisMensais,
          "repasse_parceiro",
          pId === NONE ? null : pId,
          d,
          p?.percentual_padrao,
          config.percentual_parceiro_padrao,
        ),
      ),
    );
  }

  function onSelectParceiro(value: string) {
    setParceiroId(value);
    const p = parceiros.find((x) => x.id === value);
    setEmpresaParceira(p?.nome ?? "");
    if (value !== NONE) aplicarParceiro(value, dataVenda);
  }

  function onChangeData(value: string) {
    setDataVenda(value);
    aplicarComissao(construtoraId, value);
    aplicarImpostoImob(value);
    if (parceiroId !== NONE) aplicarParceiro(parceiroId, value);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const input: VendaInput = {
      data_venda: dataVenda,
      construtora_id: construtoraId === NONE ? null : construtoraId,
      empreendimento_id: empreendimentoId === NONE ? null : empreendimentoId,
      unidade: unidade.trim() || null,
      torre: torre.trim() || null,
      cliente: cliente.trim() || null,
      cliente_nascimento: clienteNascimento || null,
      cliente_telefone: clienteTelefone.trim() || null,
      cliente_cpf: clienteCpf.trim() || null,
      origem: origem || null,
      origem_detalhe: origemDetalhe.trim() || null,
      cliente_finalidade: finalidade || null,
      cliente_profissao: profissao.trim() || null,
      cliente_cidade: clienteCidade.trim() || null,
      cliente_estado: clienteEstado || null,
      cliente_email: clienteEmail.trim() || null,
      corretor_id: corretorId === NONE ? null : corretorId,
      percentual_corretor: pctCorretorPreview,
      percentual_imposto_nf: pctImpostoNfAtual,
      recebimento_parcelado: parcelado,
      parcelas: parcelado ? parcelas : [],
      possui_parceria: possuiParceria,
      parceiro_id: possuiParceria && parceiroId !== NONE ? parceiroId : null,
      empresa_parceira: possuiParceria ? empresaParceira.trim() || null : null,
      percentual_parceria: possuiParceria ? pctToFrac(pctParceria) : 0,
      vgv: parseNumeroBR(vgv),
      percentual_comissao: pctToFrac(pctComissao),
      percentual_imposto_imobiliaria: pctToFrac(pctImpostoImob),
      observacoes: observacoes.trim() || null,
      contrato_path: contratoPath,
      documentos,
      investidores: investidoresSel,
    };

    const res =
      mode === "create"
        ? await criarVenda(input, checklist?.id)
        : await atualizarVenda(venda!.id, input);
    if (res?.error) {
      toast.error("Erro ao salvar a venda", { description: res.error });
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* CARD 1 — Dados da venda */}
        <Card>
          <CardHeader>
            <CardTitle>Dados da venda</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="data">Data da venda</Label>
              <Input
                id="data"
                type="date"
                value={dataVenda}
                onChange={(e) => onChangeData(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Construtora</Label>
              <Select value={construtoraId} onValueChange={onSelectConstrutora}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {construtoras.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Sem correspondência no cadastro, mostra o que o corretor
                  escreveu: senão quem aprova não tem como saber. */}
              {checklist && construtoraId === NONE && checklist.construtora?.trim() && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  O corretor escreveu &ldquo;{checklist.construtora.trim()}&rdquo;, que não
                  está no cadastro. Selecione a correta ou cadastre.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Empreendimento</Label>
              <Select value={empreendimentoId} onValueChange={setEmpreendimentoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {empreendimentosFiltrados.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {checklist && empreendimentoId === NONE && checklist.empreendimento?.trim() && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  O corretor escreveu &ldquo;{checklist.empreendimento.trim()}&rdquo;, que não
                  está no cadastro. Selecione o correto ou cadastre.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="unidade">Unidade</Label>
              <Input
                id="unidade"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                placeholder="Ex.: Apto 1203"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="torre">Torre</Label>
              <Input
                id="torre"
                value={torre}
                onChange={(e) => setTorre(e.target.value)}
                placeholder="Ex.: Torre A"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente">Nome completo do cliente</Label>
              <Input
                id="cliente"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente-cpf">CPF do cliente</Label>
              <Input
                id="cliente-cpf"
                inputMode="numeric"
                value={clienteCpf}
                onChange={(e) => setClienteCpf(formatarCpf(e.target.value))}
                placeholder="000.000.000-00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente-nasc">Data de nascimento</Label>
              <Input
                id="cliente-nasc"
                type="date"
                value={clienteNascimento}
                onChange={(e) => setClienteNascimento(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente-tel">Telefone do cliente</Label>
              <Input
                id="cliente-tel"
                inputMode="tel"
                value={clienteTelefone}
                onChange={(e) => setClienteTelefone(e.target.value)}
                placeholder="(47) 90000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente-email">E-mail do cliente</Label>
              <Input
                id="cliente-email"
                type="email"
                value={clienteEmail}
                onChange={(e) => setClienteEmail(e.target.value)}
                placeholder="cliente@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente-prof">Profissão</Label>
              <Input
                id="cliente-prof"
                value={profissao}
                onChange={(e) => setProfissao(e.target.value)}
                placeholder="Ex.: Médico, Empresário"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente-cidade">Cidade do cliente</Label>
              <Input
                id="cliente-cidade"
                value={clienteCidade}
                onChange={(e) => setClienteCidade(e.target.value)}
                placeholder="Onde o cliente mora"
              />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={clienteEstado || SEM_ORIGEM}
                onValueChange={(v) => setClienteEstado(v === SEM_ORIGEM ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_ORIGEM}>Não informado</SelectItem>
                  {UFS.map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Finalidade da compra</Label>
              <Select
                value={finalidade || SEM_ORIGEM}
                onValueChange={(v) => setFinalidade(v === SEM_ORIGEM ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_ORIGEM}>Não informado</SelectItem>
                  {FINALIDADES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>De onde veio o cliente</Label>
              <Select
                value={origem || SEM_ORIGEM}
                onValueChange={(v) => setOrigem(v === SEM_ORIGEM ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_ORIGEM}>Não informado</SelectItem>
                  {ORIGENS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="origem-det">
                Detalhe da origem{" "}
                <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="origem-det"
                value={origemDetalhe}
                onChange={(e) => setOrigemDetalhe(e.target.value)}
                placeholder={DICA_ORIGEM[origem] ?? "Quem indicou, qual portal, qual evento"}
              />
            </div>
            <div className="space-y-2">
              <Label>Corretor responsável</Label>
              <Select value={corretorId} onValueChange={setCorretorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {corretores.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="vgv">Valor do contrato (VGV)</Label>
              <Input
                id="vgv"
                inputMode="decimal"
                value={vgv}
                onChange={(e) => setVgv(e.target.value)}
                placeholder="431.790,00"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* CARD 2 — Parceria */}
        <Card>
          <CardHeader>
            <CardTitle>Parceria</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Possui parceria?</Label>
              <Select
                value={possuiParceria ? "sim" : "nao"}
                onValueChange={(v) => setPossuiParceria(v === "sim")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao">Não</SelectItem>
                  <SelectItem value="sim">Sim</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {possuiParceria ? (
              <>
                <div className="space-y-2">
                  <Label>Parceiro</Label>
                  <Select value={parceiroId} onValueChange={onSelectParceiro}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o parceiro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {parceiros.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pct-parceria">% da parceria (sobre o VGV)</Label>
                  <Input
                    id="pct-parceria"
                    inputMode="decimal"
                    value={pctParceria}
                    onChange={(e) => setPctParceria(e.target.value)}
                    placeholder="17,5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 sm:col-span-2">
                  <Calculado label="Valor da parceria" valor={calc.valorParceria} />
                  <Calculado
                    label="Líquido pós-parceria"
                    valor={calc.liquidoPosParceria}
                  />
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* CARD 3 — Valores e percentuais gerais (cadeia da imobiliária) */}
        <Card>
          <CardHeader>
            <CardTitle>Valores e percentuais gerais</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Calculado label="VGV" valor={parseNumeroBR(vgv)} />
            <div className="space-y-2">
              <Label htmlFor="pctComissao">% pago pela construtora</Label>
              <Input
                id="pctComissao"
                inputMode="decimal"
                value={pctComissao}
                onChange={(e) => setPctComissao(e.target.value)}
                placeholder="5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pctImpostoImob">% imposto a reter</Label>
              <Input
                id="pctImpostoImob"
                inputMode="decimal"
                value={pctImpostoImob}
                onChange={(e) => setPctImpostoImob(e.target.value)}
                placeholder="11,9"
              />
            </div>
            <Calculado label="R$ imposto" valor={calc.valorImposto} />
            <Calculado label="Líquido pós imposto" valor={calc.liquidoZefer} />
          </CardContent>
        </Card>

        {/* CARD 4 — Valores e percentuais do corretor */}
        <Card>
          <CardHeader>
            <CardTitle>Valores e percentuais do corretor</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pctCorretor">% comissão do corretor</Label>
              <Input
                id="pctCorretor"
                inputMode="decimal"
                value={
                  pctCorretorEdit === null
                    ? fracaoParaPctStr(pctCorretorPadrao)
                    : pctCorretorEdit
                }
                onChange={(e) => setPctCorretorEdit(e.target.value)}
                placeholder="30"
              />
              <p className="text-xs text-muted-foreground">
                {pctCorretorEdit === null
                  ? "Padrão do cadastro do corretor. Altere para acordos específicos desta venda."
                  : `Padrão do cadastro: ${fracaoParaPctStr(pctCorretorPadrao)}%.`}
              </p>
            </div>
            <Calculado label="Comissão do corretor" valor={calc.comissaoCorretorBruto} />
            <div className="space-y-2">
              <Label htmlFor="pctImpostoNf">% imposto da NF do corretor</Label>
              <Input
                id="pctImpostoNf"
                inputMode="decimal"
                value={
                  pctImpostoNfEdit === null
                    ? fracaoParaPctStr(pctImpostoNfPreview)
                    : pctImpostoNfEdit
                }
                onChange={(e) => setPctImpostoNfEdit(e.target.value)}
                placeholder="6"
              />
              <p className="text-xs text-muted-foreground">
                {pctImpostoNfEdit === null
                  ? "Padrão do cadastro do corretor. Salvar aqui atualiza a venda no módulo Corretores."
                  : `Padrão do cadastro: ${fracaoParaPctStr(pctImpostoNfPreview)}%.`}
              </p>
            </div>
            <Calculado label="R$ imposto da NF" valor={calc.valorImpostoNf} />
            <Calculado label="Líquido do corretor" valor={calc.liquidoCorretor} />
          </CardContent>
        </Card>

        {/* CARD 5 — Recebimento da construtora (parcelado) */}
        <Card>
          <CardHeader>
            <CardTitle>Recebimento da construtora</CardTitle>
            <p className="text-sm text-muted-foreground">
              Em algumas vendas a construtora libera a comissão mês a mês, conforme o cliente
              paga. Marcando aqui, o repasse do investidor deixa de sair de uma vez e passa a
              acompanhar cada parcela liberada.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={parcelado}
                onChange={(e) => setParcelado(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium">
                A construtora paga esta comissão parcelada
              </span>
            </label>

            {parcelado && (
              <>
                <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
                  <div className="space-y-2">
                    <Label htmlFor="qtdParcelas">Parcelas</Label>
                    <Input
                      id="qtdParcelas"
                      inputMode="numeric"
                      value={qtdGerar}
                      onChange={(e) => setQtdGerar(e.target.value)}
                      className="w-24"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="primeiroVenc">1º vencimento</Label>
                    <Input
                      id="primeiroVenc"
                      type="date"
                      value={primeiroVenc}
                      onChange={(e) => setPrimeiroVenc(e.target.value)}
                      className="w-44"
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={gerarParcelas}>
                    Gerar parcelas
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Divide a comissão bruta ({formatBRL(calc.comissaoBruta)}) em parcelas mensais
                    iguais. Depois dá para ajustar cada uma.
                  </p>
                </div>

                {parcelas.length > 0 && (
                  <div className="space-y-2">
                    {parcelas.map((p, idx) => (
                      <div
                        key={p.numero}
                        className="grid grid-cols-[2rem_1fr_1fr_1fr_auto] items-center gap-2"
                      >
                        <span className="text-sm text-muted-foreground">{p.numero}</span>
                        <Input
                          type="date"
                          value={p.vencimento}
                          onChange={(e) => editarParcela(idx, { vencimento: e.target.value })}
                        />
                        <Input
                          inputMode="decimal"
                          value={String(p.valor).replace(".", ",")}
                          onChange={(e) =>
                            editarParcela(idx, { valor: parseNumeroBR(e.target.value) })
                          }
                        />
                        <Input
                          type="date"
                          value={p.recebido_em ?? ""}
                          onChange={(e) =>
                            editarParcela(idx, { recebido_em: e.target.value || null })
                          }
                          title="Data em que a construtora efetivamente pagou"
                        />
                        <button
                          type="button"
                          onClick={() => setParcelas((ps) => ps.filter((_, i) => i !== idx))}
                          className="px-2 text-sm text-muted-foreground hover:text-destructive"
                        >
                          remover
                        </button>
                      </div>
                    ))}
                    <div className="grid grid-cols-[2rem_1fr_1fr_1fr_auto] gap-2 text-xs text-muted-foreground">
                      <span />
                      <span>vencimento previsto</span>
                      <span>valor liberado</span>
                      <span>recebido em (real)</span>
                      <span />
                    </div>
                    <p
                      className={`text-sm ${
                        Math.abs(somaParcelas - round2(calc.comissaoBruta)) < 0.01
                          ? "text-muted-foreground"
                          : "text-amber-600"
                      }`}
                    >
                      Soma das parcelas: <b>{formatBRL(somaParcelas)}</b>
                      {Math.abs(somaParcelas - round2(calc.comissaoBruta)) < 0.01
                        ? " · fecha com a comissão bruta"
                        : ` · comissão bruta é ${formatBRL(calc.comissaoBruta)}`}
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* CARD 6 — Observações e documentos (não são valores, card próprio) */}
        <Card>
          <CardHeader>
            <CardTitle>Observações e documentos</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="obs">Observações</Label>
              <Textarea
                id="obs"
                rows={4}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Condições combinadas, pendências, o que mais precisar registrar."
              />
              <p className="text-xs text-muted-foreground">
                {observacoes.length}/2000
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Contrato assinado</Label>
              <ContratoUpload value={contratoPath} onChange={setContratoPath} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Documentos do cliente</Label>
              <DocumentosUpload value={documentos} onChange={setDocumentos} />
            </div>
          </CardContent>
        </Card>

        {investidores.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Investidores</CardTitle>
              <p className="text-sm text-muted-foreground">
                Marque quem participa desta venda. O repasse entra sozinho como
                despesa variável, e acompanha o lucro se a venda mudar.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {investidores.map((i) => {
                const marcado = investidoresSel.includes(i.id);
                const repasse = calc.lucroLiquido * (i.percentual / 100);
                return (
                  <label
                    key={i.id}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/40"
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={(e) =>
                          setInvestidoresSel((atual) =>
                            e.target.checked
                              ? [...atual, i.id]
                              : atual.filter((x) => x !== i.id),
                          )
                        }
                        className="h-4 w-4"
                      />
                      <span>
                        <span className="font-medium">{i.nome}</span>
                        <span className="ml-2 text-sm text-muted-foreground">
                          {i.percentual}%
                        </span>
                      </span>
                    </span>
                    <span
                      className={`tabular-nums text-sm ${marcado ? "font-medium" : "text-muted-foreground/50"}`}
                    >
                      {formatBRL(repasse)}
                    </span>
                  </label>
                );
              })}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* PAINEL RESULTADO */}
      <div className="lg:col-span-1">
        <Card className="lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <ResumoLinha label="Comissão bruta" valor={calc.comissaoBruta} />
            <ResumoLinha
              label="(−) Parceiro"
              valor={-calc.valorParceria}
              muted={!possuiParceria}
            />
            <ResumoLinha label="Líquido pós-parceria" valor={calc.liquidoPosParceria} divider />
            <ResumoLinha label="(−) Imposto" valor={-calc.valorImposto} />
            <ResumoLinha label="Líquido Zefer" valor={calc.liquidoZefer} highlight divider />

            <div className="pt-4">
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {mode === "create" ? "Cadastrar venda" : "Salvar alterações"}
              </Button>
              <Button asChild variant="ghost" className="mt-2 w-full">
                <Link href="/vendas">Cancelar</Link>
              </Button>
            </div>
            <p className="pt-2 text-xs text-muted-foreground">
              A comissão do corretor é gerida no módulo Corretores.
            </p>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

function Calculado({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm tabular-nums">
        {formatBRL(valor)}
      </div>
    </div>
  );
}

