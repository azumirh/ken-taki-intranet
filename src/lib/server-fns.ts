import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://nxmwhtkygiljkbovwixk.supabase.co";

type CriarGestorInput = {
  email: string;
  nome: string;
  filial: "cristo-rei" | "champagnat";
  cpf3?: string | undefined;
  cargo?: string | undefined;
  nascimento?: string | undefined;
  admissao?: string | undefined;
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
    const payload = JSON.parse(Buffer.from(b64 + padding, "base64").toString("utf-8")) as {
      role?: string;
    };
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

    const admin = createClient(SUPABASE_URL, serviceKey, {
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

    // Enviar e-mail de boas-vindas via Resend (falha silenciosa se não configurado)
    const resendKey = process.env["RESEND_API_KEY"];
    if (resendKey) {
      const filialNomeMap: Record<string, string> = {
        "cristo-rei": "Cristo Rei",
        champagnat: "Champagnat",
      };
      const filialLabel = filialNomeMap[data.filial] ?? data.filial;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Azumi RH <no-reply@azumirh.com.br>",
          to: [data.email.trim().toLowerCase()],
          subject: "Seu acesso à intranet Ken Taki",
          html: `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e8e0ee">
  <div style="background:linear-gradient(100deg,#6b1e3c,#5a2d82);padding:32px 32px 24px">
    <p style="margin:0;color:#fff;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.8">Intranet Ken Taki × Azumi RH</p>
    <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:800">Bem-vindo(a), ${data.nome.trim()}!</h1>
  </div>
  <div style="padding:32px">
    <p style="color:#444;margin:0 0 16px">Sua conta de gestor foi criada para a unidade <strong>${filialLabel}</strong>.</p>
    <div style="background:#f5f0fa;border-radius:12px;padding:20px;margin-bottom:20px">
      <p style="margin:0 0 8px;font-size:13px;color:#666">E-mail de acesso</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#3a1060;font-family:monospace">${data.email.trim().toLowerCase()}</p>
      <p style="margin:16px 0 8px;font-size:13px;color:#666">Senha temporária</p>
      <p style="margin:0;font-size:22px;font-weight:800;color:#3a1060;letter-spacing:.08em;font-family:monospace">${senhaTemp}</p>
    </div>
    <p style="color:#666;font-size:13px;margin:0 0 8px">No primeiro acesso você será solicitado(a) a criar uma senha própria.</p>
    <p style="color:#999;font-size:12px;margin:0">Em caso de dúvidas, entre em contato com a equipe Azumi RH.</p>
  </div>
</div>`,
        }),
      }).catch(() => {
        // Ignora erros de envio — o acesso já foi criado com sucesso
      });
    }

    return { senhaTemp };
  });

export const listarGestoresFn = createServerFn({ method: "GET" }).handler(async () => {
  const serviceKey = validarServiceKey(process.env["SUPABASE_SERVICE_ROLE_KEY"]);
  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin
    .from("kt_perfis")
    .select("id, nome, email:id, tipo, filial, created_at")
    .eq("tipo", "gestor")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  // Buscar emails dos usuários Auth (batch)
  const ids: string[] = (data ?? []).map((r: { id: string }) => r.id);
  const emailMap: Record<string, string> = {};
  for (const id of ids) {
    const { data: user } = await admin.auth.admin.getUserById(id);
    if (user?.user?.email) emailMap[id] = user.user.email;
  }
  return (data ?? []).map(
    (r: { id: string; nome: string; tipo: string; filial: string | null; created_at: string }) => ({
      id: r.id,
      nome: r.nome,
      email: emailMap[r.id] ?? "",
      filial: r.filial,
      created_at: r.created_at,
    }),
  );
});

export const desativarGestorFn = createServerFn({ method: "POST" })
  .validator((input: { userId: string }) => input)
  .handler(async ({ data }) => {
    const serviceKey = validarServiceKey(process.env["SUPABASE_SERVICE_ROLE_KEY"]);
    const admin = createClient(SUPABASE_URL, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
