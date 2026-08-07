import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

type CriarGestorInput = {
  email: string;
  nome: string;
  filial: "cristo-rei" | "champagnat";
};

function gerarSenhaTemp(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  const suf = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `Ken@${num}${suf}`;
}

function validarServiceKey(key: string | undefined): string {
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.");
  const clean = key.trim().replace(/^["']|["']$/g, "");
  try {
    const parts = clean.split(".");
    if (parts.length !== 3) throw new Error("formato inválido");
    // JWTs usam base64url; Buffer.from lida corretamente no Node.js
    const b64 = (parts[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
    const padding = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const payload = JSON.parse(
      Buffer.from(b64 + padding, "base64").toString("utf-8"),
    ) as { role?: string };
    if (payload.role !== "service_role") {
      throw new Error(
        `Chave com role="${payload.role}" — precisa ser a service_role key, não a anon key.`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("role=")) throw e;
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não é um JWT válido.");
  }
  return clean;
}

export const criarGestorFn = createServerFn({ method: "POST" })
  .validator((input: CriarGestorInput) => input)
  .handler(async ({ data }) => {
    const serviceKey = validarServiceKey(process.env["SUPABASE_SERVICE_ROLE_KEY"]);

    const admin = createClient("https://nxmwhtkygiljkbovwixk.supabase.co", serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const senhaTemp = gerarSenhaTemp();

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: data.email.trim().toLowerCase(),
      password: senhaTemp,
      email_confirm: true,
    });

    if (authError) throw new Error(authError.message);

    const { error: perfilError } = await admin.from("kt_perfis").insert({
      id: authData.user.id,
      tipo: "gestor",
      filial: data.filial,
      nome: data.nome.trim(),
      precisa_trocar_senha: true,
      updated_at: new Date().toISOString(),
    });

    if (perfilError) {
      await admin.auth.admin.deleteUser(authData.user.id);
      throw new Error(perfilError.message);
    }

    return { senhaTemp };
  });
