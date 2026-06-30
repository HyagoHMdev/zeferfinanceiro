/**
 * Cria (ou promove) o primeiro usuário administrador.
 *
 * Uso:
 *   node scripts/criar-admin.mjs <email> <senha> "<Nome>"
 *
 * Requer as variáveis em .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Carrega .env.local de forma simples (sem dependência extra).
function loadEnv() {
  try {
    const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env.local ausente — usa o ambiente atual.
  }
}

loadEnv();

const [, , email, senha, nome] = process.argv;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !senha) {
  console.error('Uso: node scripts/criar-admin.mjs <email> <senha> "<Nome>"');
  process.exit(1);
}
if (!url || !serviceKey) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.createUser({
  email,
  password: senha,
  email_confirm: true,
  user_metadata: { nome: nome ?? email },
});

if (error) {
  console.error("Erro ao criar usuário:", error.message);
  process.exit(1);
}

const userId = data.user.id;

// O trigger handle_new_user já criou o profile; promovemos para admin.
const { error: upErr } = await admin
  .from("profiles")
  .update({ role: "admin", nome: nome ?? email, ativo: true })
  .eq("id", userId);

if (upErr) {
  console.error("Usuário criado, mas falhou ao definir o papel admin:", upErr.message);
  process.exit(1);
}

console.log(`Admin criado: ${email} (id ${userId})`);
