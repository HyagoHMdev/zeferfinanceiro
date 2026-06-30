import type { Metadata } from "next";

import { LoginForm } from "@/components/login-form";
import { LogoBadge } from "@/components/logo-badge";
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
          <LogoBadge height={72} />
          <div className="text-center">
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
