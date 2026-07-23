"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Rolagem horizontal seguindo o mouse: quando o cursor se aproxima da borda
  // direita (ou esquerda) da tabela, ela rola sozinha para aquele lado. Assim
  // dá para ver as colunas escondidas sem precisar descer até a barra de
  // rolagem lá no rodapé. Só age quando a tabela é mais larga que a área visível.
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let raf = 0;
    let velocidade = 0; // px por frame; o sinal indica a direção (+ direita, - esquerda)

    const passo = () => {
      const antes = el.scrollLeft;
      el.scrollLeft += velocidade;
      // Continua enquanto realmente há movimento. Ao bater na ponta (scrollLeft
      // não muda) ou zerar a velocidade, encerra o loop até o próximo mousemove.
      if (velocidade !== 0 && el.scrollLeft !== antes) {
        raf = requestAnimationFrame(passo);
      } else {
        raf = 0;
      }
    };
    const ligar = () => {
      if (!raf && velocidade !== 0) raf = requestAnimationFrame(passo);
    };

    const onMove = (e: MouseEvent) => {
      if (el.scrollWidth - el.clientWidth <= 1) {
        velocidade = 0; // sem overflow: nada a rolar
        return;
      }
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      // Faixa sensível nas bordas: ~18% da largura, limitada entre 48 e 140px.
      const zona = Math.min(140, Math.max(48, r.width * 0.18));
      const vMax = 16; // px por frame no encostar da borda
      if (x > r.width - zona) {
        velocidade = Math.ceil(((x - (r.width - zona)) / zona) * vMax);
      } else if (x < zona) {
        velocidade = -Math.ceil(((zona - x) / zona) * vMax);
      } else {
        velocidade = 0;
      }
      ligar();
    };
    const onLeave = () => {
      velocidade = 0;
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-muted-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
