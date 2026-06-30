import { getConfig } from "@/lib/data/cadastros";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ParametrosForm } from "@/components/configuracoes/parametros-form";

export default async function ParametrosPage() {
  const config = await getConfig();
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Parâmetros do sistema</CardTitle>
      </CardHeader>
      <CardContent>
        <ParametrosForm config={config} />
      </CardContent>
    </Card>
  );
}
