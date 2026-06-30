"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function ConfiguracoesNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = [
    { href: "/configuracoes", label: "Parâmetros", exact: true },
    ...(isAdmin
      ? [
          { href: "/configuracoes/cadastros", label: "Cadastros", exact: false },
          { href: "/configuracoes/usuarios", label: "Usuários", exact: false },
        ]
      : []),
  ];

  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
