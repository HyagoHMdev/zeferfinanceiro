import { ModuloLancamentos } from "@/components/financeiro/modulo-lancamentos";

export default function CustosFixosPage() {
  return (
    <ModuloLancamentos
      titulo="Custos Fixos"
      descricao="Despesas fixas recorrentes da empresa."
      escopo="empresa"
      naturezas={["custo_fixo"]}
      naturezaFixaCriar="custo_fixo"
    />
  );
}
