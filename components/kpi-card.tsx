import * as React from "react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";

interface KpiCardProps {
  label: string;
  value: number;
  /** Quando true, formata o valor como moeda (R$). Caso contrário, mostra o número. */
  currency?: boolean;
  hint?: string;
  icon?: React.ReactNode;
  /** Cor de destaque do valor. */
  tone?: "default" | "positive" | "negative";
}

/** Cartão de indicador usado no dashboard e relatórios. */
export function KpiCard({
  label,
  value,
  currency = true,
  hint,
  icon,
  tone = "default",
}: KpiCardProps) {
  return (
    <Card className="gap-2 py-4">
      <CardContent className="px-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        </div>
        <div
          className={cn(
            "mt-2 text-2xl font-semibold tracking-tight tabular-nums",
            tone === "positive" && "text-success",
            tone === "negative" && "text-destructive",
          )}
        >
          {currency
            ? formatBRL(value)
            : value.toLocaleString("pt-BR")}
        </div>
        {hint ? (
          <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
