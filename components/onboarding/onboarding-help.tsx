"use client";

import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";

import { ONBOARDING, type OnboardingScreen } from "@/lib/onboarding";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Versão do onboarding: incremente para reexibir a ajuda a todos após uma revisão.
const VERSAO = "v1";
const chave = (screen: OnboardingScreen) => `zefer-onboarding-${VERSAO}-${screen}`;

/**
 * Botão "?" no cabeçalho da tela. Abre um painel explicando a tela. Na primeira
 * visita abre sozinho; depois só ao clicar. O "já vi" fica no navegador
 * (localStorage), por tela.
 */
export function OnboardingHelp({ screen }: { screen: OnboardingScreen }) {
  const conteudo = ONBOARDING[screen];
  const [open, setOpen] = useState(false);

  // Abre automaticamente na primeira visita (client-only, evita descasar a hidratação).
  useEffect(() => {
    try {
      if (localStorage.getItem(chave(screen))) return;
    } catch {
      return; // localStorage indisponível — não abre sozinho
    }
    // Auto-abre na 1ª visita; o "já visto" só pode ser lido no client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [screen]);

  function marcarVisto() {
    try {
      localStorage.setItem(chave(screen), "1");
    } catch {
      // ignora
    }
  }

  function onOpenChange(v: boolean) {
    setOpen(v);
    if (!v) marcarVisto(); // ao fechar (de qualquer forma), não abre mais sozinho
  }

  if (!conteudo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-foreground"
        aria-label="Ajuda desta tela"
        title="Ajuda desta tela"
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="size-5" />
      </Button>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{conteudo.titulo}</DialogTitle>
          <DialogDescription>{conteudo.intro}</DialogDescription>
        </DialogHeader>

        <ul className="space-y-3">
          {conteudo.topicos.map((t) => (
            <li key={t.titulo} className="text-sm">
              <div className="font-semibold">{t.titulo}</div>
              <div className="text-muted-foreground">{t.texto}</div>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
