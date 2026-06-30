import { ModuloLancamentos } from "@/components/financeiro/modulo-lancamentos";

export default function DespesasVariaveisPage() {
  return (
    <ModuloLancamentos
      titulo="Despesas Variáveis"
      descricao="Despesas variáveis da empresa."
      escopo="empresa"
      naturezas={["despesa_variavel"]}
      naturezaFixaCriar="despesa_variavel"
    />
  );
}
