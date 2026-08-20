import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { BRAND } from "./brand";

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

type ValidarColaboradorInput = {
  nome: string;
  cpf3: string;
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

function criarAdminClient() {
  const serviceKey = validarServiceKey(process.env["SUPABASE_SERVICE_ROLE_KEY"]);
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const validarColaboradorFn = createServerFn({ method: "POST" })
  .validator((input: ValidarColaboradorInput) => input)
  .handler(async ({ data }) => {
    const nome = data.nome.trim();
    const cpf3 = data.cpf3.trim();

    if (nome.length < 3 || !/^\d{3}$/.test(cpf3)) {
      return { ok: false as const, motivo: "dados_invalidos" as const };
    }

    const admin = criarAdminClient();
    const { data: colaboradores, error } = await admin
      .from("kt_colaboradores")
      .select("id,nome,filial,cpf3,ativo")
      .eq("filial", data.filial)
      .eq("cpf3", cpf3)
      .eq("ativo", true)
      .limit(10);

    if (error) throw new Error(error.message);

    const nomeNorm = nome.toLocaleLowerCase("pt-BR");
    const match = (colaboradores ?? []).find((c) =>
      String(c.nome).toLocaleLowerCase("pt-BR").startsWith(nomeNorm),
    );

    if (!match) return { ok: false as const, motivo: "nao_encontrado" as const };

    return {
      ok: true as const,
      colaborador: {
        id: String(match.id),
        nome: String(match.nome),
        filial: String(match.filial) as "cristo-rei" | "champagnat",
      },
    };
  });

export const criarGestorFn = createServerFn({ method: "POST" })
  .validator((input: CriarGestorInput) => input)
  .handler(async ({ data }) => {
    const admin = criarAdminClient();

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
      ativo: true,
      updated_at: new Date().toISOString(),
    });

    if (perfilError) {
      await admin.auth.admin.deleteUser(authData.user.id);
      throw new Error(perfilError.message);
    }

    let emailEnviado = false;
    const resendKey = process.env["RESEND_API_KEY"];
    if (resendKey) {
      const filialNomeMap: Record<string, string> = {
        "cristo-rei": "Cristo Rei",
        champagnat: "Champagnat",
      };
      const filialLabel = filialNomeMap[data.filial] ?? data.filial;
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: BRAND.emailFrom,
            to: [data.email.trim().toLowerCase()],
            subject: "Seu acesso à intranet Ken Taki",
            html: `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e7e1dc">
  <div style="background:#6b1e3c;padding:32px 32px 24px">
    <p style="margin:0;color:#fff;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">Ken Taki · Intranet</p>
    <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:800">Bem-vindo(a), ${data.nome.trim()}!</h1>
  </div>
  <div style="padding:32px">
    <p style="color:#444;margin:0 0 16px">Seu acesso de gestor foi criado para a unidade <strong>${filialLabel}</strong>.</p>
    <div style="background:#f7f3ef;border-radius:10px;padding:20px;margin-bottom:20px">
      <p style="margin:0 0 8px;font-size:13px;color:#666">E-mail de acesso</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#4b172a;font-family:monospace">${data.email.trim().toLowerCase()}</p>
      <p style="margin:16px 0 8px;font-size:13px;color:#666">Senha temporária</p>
      <p style="margin:0;font-size:22px;font-weight:800;color:#4b172a;letter-spacing:.08em;font-family:monospace">${senhaTemp}</p>
    </div>
    <p style="color:#666;font-size:13px;margin:0">No primeiro acesso, você deverá criar uma senha própria.</p>
  </div>
</div>`,
          }),
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          console.error("[ken-taki] falha no envio de e-mail de acesso", {
            status: response.status,
            detail,
            email: data.email.trim().toLowerCase(),
          });
        } else {
          emailEnviado = true;
        }
      } catch (error) {
        console.error("[ken-taki] erro de rede ao enviar e-mail de acesso", error);
      }
    } else {
      console.warn("[ken-taki] RESEND_API_KEY não configurada; acesso criado sem e-mail.");
    }

    return { senhaTemp, emailEnviado };
  });

export const listarGestoresFn = createServerFn({ method: "GET" }).handler(async () => {
  const admin = criarAdminClient();
  const { data, error } = await admin
    .from("kt_perfis")
    .select("id, nome, tipo, filial, ativo, created_at")
    .eq("tipo", "gestor")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const ids: string[] = (data ?? []).map((r: { id: string }) => r.id);
  const emailMap: Record<string, string> = {};
  for (const id of ids) {
    const { data: user } = await admin.auth.admin.getUserById(id);
    if (user?.user?.email) emailMap[id] = user.user.email;
  }

  return (data ?? []).map(
    (r: {
      id: string;
      nome: string;
      tipo: string;
      filial: string | null;
      ativo: boolean;
      created_at: string;
    }) => ({
      id: r.id,
      nome: r.nome,
      email: emailMap[r.id] ?? "",
      filial: r.filial,
      ativo: r.ativo,
      created_at: r.created_at,
    }),
  );
});

export const desativarGestorFn = createServerFn({ method: "POST" })
  .validator((input: { userId: string }) => input)
  .handler(async ({ data }) => {
    const admin = criarAdminClient();

    const { error: perfilError } = await admin
      .from("kt_perfis")
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq("id", data.userId);
    if (perfilError) throw new Error(perfilError.message);

    const { error: authError } = await admin.auth.admin.updateUserById(data.userId, {
      ban_duration: "876000h",
    });

    if (authError) {
      await admin
        .from("kt_perfis")
        .update({ ativo: true, updated_at: new Date().toISOString() })
        .eq("id", data.userId);
      throw new Error(authError.message);
    }

    return { ok: true };
  });
