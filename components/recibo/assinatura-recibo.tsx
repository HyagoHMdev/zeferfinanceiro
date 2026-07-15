"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Eraser } from "lucide-react";

import { assinarRecibo } from "@/app/recibo/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function AssinaturaRecibo({
  tipo,
  id,
  nome,
  subtitulo,
  assinaturaUrl,
  assinadoEm,
}: {
  tipo: "pagamento" | "adiantamento";
  id: string;
  nome: string;
  subtitulo?: string;
  assinaturaUrl: string | null;
  assinadoEm: string | null;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const [temTraço, setTemTraço] = useState(false);
  const [confirmo, setConfirmo] = useState(false);
  const [saving, setSaving] = useState(false);

  const assinado = Boolean(assinaturaUrl && assinadoEm);

  function ctx() {
    const c = canvasRef.current;
    return c ? c.getContext("2d") : null;
  }

  function ponto(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * c.width,
      y: ((e.clientY - r.top) / r.height) * c.height,
    };
  }

  function inicio(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const g = ctx();
    if (!g) return;
    desenhando.current = true;
    const p = ponto(e);
    g.strokeStyle = "#0f172a";
    g.lineWidth = 2.5;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(p.x, p.y);
    canvasRef.current!.setPointerCapture(e.pointerId);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    e.preventDefault();
    const g = ctx();
    if (!g) return;
    const p = ponto(e);
    g.lineTo(p.x, p.y);
    g.stroke();
    if (!temTraço) setTemTraço(true);
  }

  function fim() {
    desenhando.current = false;
  }

  function limpar() {
    const c = canvasRef.current;
    const g = ctx();
    if (c && g) g.clearRect(0, 0, c.width, c.height);
    setTemTraço(false);
  }

  async function assinar() {
    const c = canvasRef.current;
    if (!c || !temTraço) {
      toast.error("Desenhe a assinatura no quadro.");
      return;
    }
    setSaving(true);
    const dataUrl = c.toDataURL("image/png");
    const res = await assinarRecibo(tipo, id, dataUrl);
    setSaving(false);
    if (res?.error) {
      toast.error("Não foi possível assinar", { description: res.error });
      return;
    }
    toast.success("Recibo assinado. Obrigado!");
    router.refresh();
  }

  // ---- Já assinado: mostra a assinatura + aceite (também na impressão) -------
  if (assinado) {
    return (
      <div className="mt-12 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={assinaturaUrl!}
          alt="Assinatura"
          className="mx-auto h-20 object-contain"
        />
        <div className="mx-auto w-72 border-t border-zinc-400 pt-1 text-sm">
          {nome}
          {subtitulo ? (
            <div className="text-xs text-zinc-500">{subtitulo}</div>
          ) : null}
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          Assinado eletronicamente em {formatarDataHora(assinadoEm!)}
        </div>
      </div>
    );
  }

  // ---- Não assinado: quadro de assinatura (tela) + linha (impressão) ---------
  return (
    <div className="mt-12">
      {/* Quadro de assinatura — só na tela */}
      <div className="print:hidden">
        <div className="mb-1 text-center text-xs text-zinc-500">
          Assine no quadro abaixo com o dedo ou o mouse
        </div>
        <canvas
          ref={canvasRef}
          width={520}
          height={170}
          onPointerDown={inicio}
          onPointerMove={mover}
          onPointerUp={fim}
          onPointerLeave={fim}
          className="mx-auto block w-full max-w-lg touch-none rounded-md border border-zinc-300 bg-white"
        />
        <div className="mx-auto mt-2 flex max-w-lg items-center justify-between gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={limpar}>
            <Eraser className="size-4" />
            Limpar
          </Button>
          <label className="flex flex-1 items-center gap-2 text-xs text-zinc-600">
            <Checkbox
              checked={confirmo}
              onCheckedChange={(v) => setConfirmo(v === true)}
            />
            Confirmo que sou {nome} e assino este recibo.
          </label>
          <Button
            type="button"
            onClick={assinar}
            disabled={saving || !temTraço || !confirmo}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Assinar
          </Button>
        </div>
      </div>

      {/* Linha de assinatura — só na impressão (assinatura física) */}
      <div className="hidden text-center print:block">
        <div className="mx-auto mt-8 w-72 border-t border-zinc-400 pt-1 text-sm">
          {nome}
          {subtitulo ? (
            <div className="text-xs text-zinc-500">{subtitulo}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
