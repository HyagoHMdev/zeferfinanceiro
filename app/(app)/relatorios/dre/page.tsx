import { relatorioDRE } from "@/lib/data/relatorios";
import { formatBRL } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

function Linha({
  label,
  valor,
  nivel = 0,
  tipo = "normal",
}: {
  label: string;
  valor: number;
  nivel?: number;
  tipo?: "normal" | "subtotal" | "total";
}) {
  return (
    <div
      className={[
        "flex items-center justify-between py-2",
        nivel === 1 ? "pl-4 text-muted-foreground" : "",
        tipo === "subtotal" ? "border-t font-semibold" : "",
        tipo === "total" ? "border-t-2 border-foreground/20 text-base font-bold" : "",
      ].join(" ")}
    >
      <span>{label}</span>
      <span
        className={[
          "tabular-nums",
          tipo === "total" && valor >= 0 ? "text-success" : "",
          tipo === "total" && valor < 0 ? "text-destructive" : "",
        ].join(" ")}
      >
        {formatBRL(valor)}
      </span>
    </div>
  );
}

export default async function DREPage() {
  const ano = new Date().getUTCFullYear();
  const dre = await relatorioDRE(ano);

  return (
    <div>
      <PageHeader title="DRE Simplificado" description={`Demonstração do resultado — ${ano}.`} />
      <Card className="max-w-2xl">
        <CardContent>
          <Linha label="Receita Bruta" valor={dre.receitaBruta} />
          <Linha label="(−) Parceiros" valor={-dre.parceiros} nivel={1} />
          <Linha label="(−) Impostos" valor={-dre.impostos} nivel={1} />
          <Linha label="Receita Líquida" valor={dre.receitaLiquida} tipo="subtotal" />
          <Linha label="(−) Comissão Corretores" valor={-dre.comissaoCorretores} nivel={1} />
          <Linha label="Lucro Bruto" valor={dre.lucroBruto} tipo="subtotal" />
          <Linha label="(−) Despesas Fixas" valor={-dre.despesasFixas} nivel={1} />
          <Linha label="(−) Despesas Variáveis" valor={-dre.despesasVariaveis} nivel={1} />
          <Linha label="Lucro Líquido" valor={dre.lucroLiquido} tipo="total" />
        </CardContent>
      </Card>
    </div>
  );
}
