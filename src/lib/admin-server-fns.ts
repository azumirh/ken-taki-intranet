import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { BRAND } from "./brand";

const SUPABASE_URL = "https://nxmwhtkygiljkbovwixk.supabase.co";

type PermissionInput = {
  section: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

type CreateRhAdminInput = {
  accessToken: string;
  nome: string;
  email: string;
  nivel: "geral" | "parcial";
  permissions?: PermissionInput[];
};

type UpdateManagedAccessInput = {
  accessToken: string;
  userId: string;
  nome?: string;
  email?: string;
  filial?: "cristo-rei" | "champagnat";
};

function validateServiceKey(key: string | undefined): string {
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.");
  return key.trim().replace(/^["']|["']$/g, "");
}

function adminClient() {
  return createClient(SUPABASE_URL, validateServiceKey(process.env["SUPABASE_SERVICE_ROLE_KEY"]), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireGeneralAdmin(accessToken: string) {
  if (!accessToken) throw new Error("Sessão administrativa ausente.");
  const admin = adminClient();
  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !authData.user) throw new Error("Sessão administrativa inválida.");

  const { data: profile, error: profileError } = await admin
    .from("kt_perfis")
    .select("id,tipo,admin_nivel,ativo,nome")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    !["azumi", "rh"].includes(String(profile.tipo)) ||
    profile.admin_nivel !== "geral" ||
    profile.ativo === false
  ) {
    throw new Error("Apenas administrador geral do RH pode gerenciar acessos.");
  }

  return { admin, actor: profile };
}

function temporaryPassword() {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  const number = Math.floor(1000 + Math.random() * 9000);
  return `Ken@${number}${suffix}`;
}

async function sendAccessEmail(args: {
  email: string;
  nome: string;
  roleLabel: string;
  temporaryPassword: string;
}) {
  const resendKey = process.env["RESEND_API_KEY"];
  if (!resendKey) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: BRAND.emailFrom,
      to: [args.email],
      subject: "Seu acesso administrativo à intranet Ken Taki",
      html: `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border:1px solid #ded8d2;border-radius:12px;overflow:hidden">
        <div style="background:#3c2937;padding:30px 32px;color:#f6f0e8">
          <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;opacity:.72">Ken Taki · Intranet</div>
          <h1 style="margin:8px 0 0;font-size:24px">Acesso de ${args.roleLabel}</h1>
        </div>
        <div style="padding:30px 32px;color:#322d30">
          <p>Olá, <strong>${args.nome}</strong>. Seu acesso foi criado.</p>
          <div style="margin:20px 0;padding:18px;background:#f5f1ed;border-radius:10px">
            <div style="font-size:12px;color:#756d71">E-mail</div>
            <div style="font-family:monospace;font-weight:700;margin-top:4px">${args.email}</div>
            <div style="font-size:12px;color:#756d71;margin-top:16px">Senha temporária</div>
            <div style="font-family:monospace;font-size:20px;font-weight:800;margin-top:4px">${args.temporaryPassword}</div>
          </div>
          <p style="font-size:13px;color:#756d71">No primeiro acesso, crie sua senha pessoal.</p>
        </div>
      </div>`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[ken-taki] falha ao enviar acesso administrativo", response.status, detail);
    return false;
  }
  return true;
}

export const criarAdminRhFn = createServerFn({ method: "POST" })
  .validator((input: CreateRhAdminInput) => input)
  .handler(async ({ data }) => {
    const { admin } = await requireGeneralAdmin(data.accessToken);
    const email = data.email.trim().toLowerCase();
    const nome = data.nome.trim();
    if (nome.length < 2 || !email.includes("@")) throw new Error("Nome ou e-mail inválido.");

    const senhaTemp = temporaryPassword();
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password: senhaTemp,
      email_confirm: true,
    });
    if (authError || !authData.user) throw new Error(authError?.message ?? "Falha ao criar usuário.");

    const { error: profileError } = await admin.from("kt_perfis").insert({
      id: authData.user.id,
      tipo: "rh",
      filial: null,
      nome,
      precisa_trocar_senha: true,
      ativo: true,
      admin_nivel: data.nivel,
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(authData.user.id);
      throw new Error(profileError.message);
    }

    if (data.nivel === "parcial" && data.permissions?.length) {
      const { error: permissionsError } = await admin.from("kt_admin_permissions").insert(
        data.permissions.map((permission) => ({
          profile_id: authData.user.id,
          ...permission,
          updated_at: new Date().toISOString(),
        })),
      );
      if (permissionsError) {
        await admin.from("kt_perfis").delete().eq("id", authData.user.id);
        await admin.auth.admin.deleteUser(authData.user.id);
        throw new Error(permissionsError.message);
      }
    }

    const emailEnviado = await sendAccessEmail({
      email,
      nome,
      roleLabel: data.nivel === "geral" ? "Administrador geral" : "Administrador parcial",
      temporaryPassword: senhaTemp,
    }).catch(() => false);

    return { id: authData.user.id, email, senhaTemp, emailEnviado };
  });

export const atualizarAcessoGerenciadoFn = createServerFn({ method: "POST" })
  .validator((input: UpdateManagedAccessInput) => input)
  .handler(async ({ data }) => {
    const { admin } = await requireGeneralAdmin(data.accessToken);
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.nome?.trim()) updates["nome"] = data.nome.trim();
    if (data.filial) updates["filial"] = data.filial;

    const { error: profileError } = await admin.from("kt_perfis").update(updates).eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);

    if (data.email?.trim()) {
      const { error: authError } = await admin.auth.admin.updateUserById(data.userId, {
        email: data.email.trim().toLowerCase(),
      });
      if (authError) throw new Error(authError.message);
    }

    return { ok: true };
  });

export const desativarAcessoGerenciadoFn = createServerFn({ method: "POST" })
  .validator((input: { accessToken: string; userId: string }) => input)
  .handler(async ({ data }) => {
    const { admin, actor } = await requireGeneralAdmin(data.accessToken);
    if (data.userId === actor.id) throw new Error("Você não pode desativar o próprio acesso geral.");

    const { error: profileError } = await admin
      .from("kt_perfis")
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);

    const { error: authError } = await admin.auth.admin.updateUserById(data.userId, {
      ban_duration: "876000h",
    });
    if (authError) throw new Error(authError.message);
    return { ok: true };
  });
