"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut } from "lucide-react";

import { cn } from "@/lib/utils";
import { navParaPerfil, ROLE_LABELS, type Role } from "@/lib/nav";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavProps {
  role: Role;
  userName: string;
  userEmail?: string;
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-2">
      <div className="flex size-9 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#f3da8b,#d9b75a_45%,#a87c24)] font-serif text-lg font-bold text-[#1a1206] shadow-sm ring-1 ring-[#d9b75a]/30">
        Z
      </div>
      <div className="leading-tight">
        <div className="font-semibold">Zefer</div>
        <div className="text-xs text-muted-foreground">Financeiro</div>
      </div>
    </div>
  );
}

function useSignOut() {
  const router = useRouter();
  return async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };
}

export function AppSidebar({ role, userName, userEmail }: NavProps) {
  const pathname = usePathname();
  const items = navParaPerfil(role);
  const signOut = useSignOut();

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="h-16 flex items-center border-b">
        <Brand />
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{userName}</div>
            <div className="truncate text-xs text-muted-foreground">
              {ROLE_LABELS[role]}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            title="Sair"
            aria-label="Sair"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
        {userEmail ? (
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {userEmail}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export function MobileTopbar({ role, userName }: NavProps) {
  const pathname = usePathname();
  const items = navParaPerfil(role);
  const signOut = useSignOut();

  return (
    <header className="md:hidden h-16 flex items-center justify-between border-b px-4 bg-sidebar">
      <Brand />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Menu">
            <Menu className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{userName}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenuItem key={item.href} asChild>
                <Link
                  href={item.href}
                  className={cn(
                    isActive(pathname, item.href) && "font-semibold",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={signOut}>
            <LogOut className="size-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
