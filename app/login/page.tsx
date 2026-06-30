import type { Metadata } from "next";

import { LoginForm } from "@/components/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Entrar — Zefer Financeiro",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex size-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#f3da8b,#d9b75a_45%,#a87c24)] font-serif text-2xl font-bold text-[#1a1206] shadow-md ring-1 ring-[#d9b75a]/30">
            Z
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">Zefer Financeiro</div>
            <div className="text-sm text-muted-foreground">
              Gestão de comissões e financeiro
            </div>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>
              Acesse com seu e-mail e senha cadastrados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
