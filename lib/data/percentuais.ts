import { createClient } from "@/lib/supabase/server";
import type { PercentualMensal } from "@/lib/types";

/**
 * Lista os percentuais mensais. Resiliente: se a tabela ainda não existir
 * (migração 0004 não aplicada), retorna vazio e o sistema usa os padrões.
 */
export async function listarPercentuaisMensais(): Promise<PercentualMensal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("percentuais_mensais").select("*");
  if (error) return [];
  return (data ?? []) as PercentualMensal[];
}
