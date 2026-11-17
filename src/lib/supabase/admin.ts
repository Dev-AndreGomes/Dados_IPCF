import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig, getSupabaseServiceRoleKey } from "./env";

/**
 * Cliente administrativo Supabase com Service Role Key.
 * Usar EXCLUSIVAMENTE no servidor (Server Actions e Route Handlers)
 * para criação controlada de contas shadow, reset de senha pelo pastor/admin,
 * busca de vínculo conjugal antes da autenticação e cron keep-alive.
 */
export function createSupabaseAdminClient() {
  const { url } = getSupabasePublicConfig();
  const serviceKey = getSupabaseServiceRoleKey();

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
