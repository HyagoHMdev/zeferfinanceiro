import { CalendarClock } from "lucide-react";

import { getConfig } from "@/lib/data/cadastros";
import { createClient } from "@/lib/supabase/server";
import type { PercentualMensal } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ParametrosForm } from "@/components/configuracoes/parametros-form";
import { PercentuaisMensaisDialog } from "@/components/configuracoes/percentuais-mensais-dialog";

export default async function ParametrosPage() {
  const config = await getConfig();
  const supabase = await createClient();
  const { data } = await supabase.from("percentuais_mensais").select("*");
  const percentuaisRows = (data ?? []) as unknown as PercentualMensal[];

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Parâmetros do sistema</CardTitle>
          <CardDescription>
            Percentuais padrão usados quando não há valor específico no cadastro ou no mês.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ParametrosForm config={config} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Percentuais globais por mês</CardTitle>
          <CardDescription>
            Imposto da imobiliária e dízimo podem variar mês a mês. Sem valor no
            mês, vale o padrão acima.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PercentuaisMensaisDialog
            titulo="Globais"
            entidadeId={null}
            campos={[
              { chave: "imposto_imobiliaria", label: "% Imposto imob." },
              { chave: "dizimo", label: "% Dízimo" },
            ]}
            rows={percentuaisRows}
            trigger={
              <Button variant="outline">
                <CalendarClock className="size-4" />
                Definir percentuais por mês
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
