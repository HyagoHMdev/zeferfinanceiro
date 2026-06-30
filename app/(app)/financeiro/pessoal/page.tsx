import { ModuloLancamentos } from "@/components/financeiro/modulo-lancamentos";

export default function PessoalPage() {
  return (
    <ModuloLancamentos
      titulo="Financeiro Pessoal"
      descricao="Entradas e saídas pessoais."
      escopo="pessoal"
      naturezas={["entrada_pessoal", "saida_pessoal"]}
    />
  );
}
