import { ModuloLancamentos } from "@/components/financeiro/modulo-lancamentos";

export default function InvestimentosPage() {
  return (
    <ModuloLancamentos
      titulo="Investimentos"
      descricao="Equipamentos, reforma, móveis e marketing inicial."
      escopo="empresa"
      naturezas={["investimento"]}
      naturezaFixaCriar="investimento"
    />
  );
}
