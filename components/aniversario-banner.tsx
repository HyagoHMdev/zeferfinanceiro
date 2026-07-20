"use client";

import { useEffect, useState } from "react";

export type Niver = { id: string; nome: string; telefone: string | null };

/** Link de WhatsApp com uma mensagem de parabéns pré-preenchida. */
function waLink(tel: string | null, nome: string): string | null {
  if (!tel) return null;
  let d = tel.replace(/\D/g, "");
  if (!d) return null;
  // Números brasileiros na base vêm sem DDI; prefixa 55. Número já com DDI
  // (ex.: alemão "49...") tem mais de 11 dígitos e fica como está.
  if (d.length <= 11 && !d.startsWith("55")) d = "55" + d;
  const primeiro = nome.trim().split(/\s+/)[0];
  const msg = encodeURIComponent(
    `Feliz aniversário, ${primeiro}! 🎉 A equipe Zefer deseja um dia incrível e tudo de bom para você. 🥳`,
  );
  return `https://wa.me/${d}?text=${msg}`;
}

/**
 * Aviso fixo (sticky) no topo quando há aniversariante no dia. Mesma fonte de
 * dados do painel (public.aniversariantes). Pode ser dispensado só pelo dia.
 */
export function AniversarioBanner({
  aniversariantes,
  hoje,
}: {
  aniversariantes: Niver[];
  hoje: string;
}) {
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(`aniv-dismiss-${hoje}`) === "1") setOculto(true);
    } catch {
      // sem localStorage: mantém visível
    }
  }, [hoje]);

  if (aniversariantes.length === 0 || oculto) return null;

  function dispensar() {
    try {
      localStorage.setItem(`aniv-dismiss-${hoje}`, "1");
    } catch {
      // ignora
    }
    setOculto(true);
  }

  const varios = aniversariantes.length > 1;

  return (
    <div className="sticky top-0 z-30 border-b bg-amber-50 px-4 py-2.5 text-amber-950 md:px-8 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-xl leading-none" aria-hidden>
          🎂
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {varios ? `${aniversariantes.length} aniversariantes hoje` : "Aniversário hoje"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {aniversariantes.map((a) => {
              const link = waLink(a.telefone, a.nome);
              return (
                <span key={a.id} className="inline-flex items-center gap-1.5 text-sm">
                  <span className="font-medium">{a.nome}</span>
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-[#25D366]/15 px-2 py-0.5 text-xs font-semibold text-[#128C33] transition hover:bg-[#25D366]/25 dark:text-[#25D366]"
                    >
                      Parabenizar
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">(sem telefone)</span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
        <button
          onClick={dispensar}
          className="shrink-0 rounded-md px-2 py-1 text-sm opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
          aria-label="Dispensar por hoje"
          title="Dispensar por hoje"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
