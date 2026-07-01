import { formatBRL } from "@/lib/format";

/** Linha de um painel de resumo financeiro (reusada em venda e corretor). */
export function ResumoLinha({
  label,
  valor,
  strong,
  highlight,
  muted,
  divider,
}: {
  label: string;
  valor: number;
  strong?: boolean;
  highlight?: boolean;
  muted?: boolean;
  divider?: boolean;
}) {
  return (
    <div
      className={[
        "flex items-center justify-between gap-2 py-1",
        divider ? "mt-1 border-t pt-2" : "",
        muted ? "text-muted-foreground" : "",
      ].join(" ")}
    >
      <span className={highlight ? "font-semibold" : strong ? "font-medium" : ""}>
        {label}
      </span>
      <span
        className={[
          "tabular-nums",
          highlight ? "text-base font-bold text-success" : "",
          strong ? "font-semibold" : "",
        ].join(" ")}
      >
        {formatBRL(valor)}
      </span>
    </div>
  );
}
