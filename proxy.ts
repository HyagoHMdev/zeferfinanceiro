import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Aplica a todas as rotas, exceto:
     * - _next/static, _next/image (assets)
     * - favicon, ícones gerados (icon, apple-icon) e arquivos de imagem
     */
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
