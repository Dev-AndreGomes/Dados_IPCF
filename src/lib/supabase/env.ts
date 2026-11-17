function resolveSupabaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    ""
  );
}

function resolveSupabasePublicKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    ""
  );
}

function resolveSupabaseSecretKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    ""
  );
}

export function isSupabaseConfigured(): boolean {
  const url = resolveSupabaseUrl();
  const anonKey = resolveSupabasePublicKey();
  const urlLower = url.toLowerCase();
  const keyLower = anonKey.toLowerCase();

  if (!url || !anonKey) return false;
  if (!(url.startsWith("https://") || url.startsWith("http://"))) return false;
  if (
    urlLower.includes("your-project") ||
    urlLower.includes("seu-projeto") ||
    urlLower.includes("seu_projeto") ||
    keyLower.includes("your-") ||
    keyLower.includes("sua-")
  ) {
    return false;
  }

  return anonKey.length > 20;
}

export function hasServiceRoleKey(): boolean {
  const key = resolveSupabaseSecretKey();
  if (!key) return false;
  const keyLower = key.toLowerCase();
  if (keyLower.includes("your-") || keyLower.includes("sua-")) return false;
  return key.length > 20;
}

export function getSupabasePublicConfig(): { url: string; anonKey: string } {
  const url = resolveSupabaseUrl();
  const anonKey = resolveSupabasePublicKey();

  if (!url || !anonKey) {
    throw new Error(
      "Variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY não configuradas."
    );
  }

  return { url, anonKey };
}

export function getSupabaseServiceRoleKey(): string {
  const key = resolveSupabaseSecretKey();
  if (!key) {
    throw new Error(
      "Variável SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SECRET_KEY) não configurada no servidor."
    );
  }
  return key;
}

export function getAdminMasterCpfs(): string[] {
  const raw = process.env.ADMIN_MASTER_CPFS ?? "";
  return raw
    .split(",")
    .map((item) => item.replace(/\D/g, ""))
    .filter((digits) => digits.length === 11);
}
