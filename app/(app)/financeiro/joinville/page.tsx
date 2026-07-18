import { ModuloLancamentos } from "@/components/financeiro/modulo-lancamentos";

export default function JoinvillePage() {
  return (
    <ModuloLancamentos
      titulo="Zefer Joinville"
      descricao="Entradas e saídas da Zefer Joinville."
      escopo="joinville"
      naturezas={["entrada_joinville", "saida_joinville"]}
    />
  );
}
