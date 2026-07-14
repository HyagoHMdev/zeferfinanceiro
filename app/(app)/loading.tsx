/**
 * Skeleton exibido enquanto a página (dinâmica) renderiza no servidor. Sem um
 * loading.tsx, o Next não prefetcha a rota e o clique "trava" até o servidor
 * terminar todo o render — este componente dá feedback imediato.
 */
export default function Loading() {
  return (
    <div className="animate-pulse">
      {/* Cabeçalho */}
      <div className="mb-6 space-y-2">
        <div className="h-7 w-52 rounded-md bg-muted" />
        <div className="h-4 w-72 rounded bg-muted/70" />
      </div>

      {/* Linha de indicadores */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border bg-muted/40" />
        ))}
      </div>

      {/* Bloco de conteúdo / tabela */}
      <div className="rounded-xl border">
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-full rounded bg-muted/50" />
          ))}
        </div>
      </div>
    </div>
  );
}
