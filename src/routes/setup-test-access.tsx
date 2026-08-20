import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SUPABASE_URL = "https://nxmwhtkygiljkbovwixk.supabase.co";
const TEST_PASSWORD = "KenTaki@Teste26!";

function adminClient() {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(SUPABASE_URL, key.replace(/^[\"']|[\"']$/g, ""), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const provisionTestAccessFn = createServerFn({ method: "POST" })
  .validator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const admin = adminClient();

    const { data: setupRow, error: setupError } = await admin
      .from("kt_email_outbox")
      .select("id")
      .eq("event_type", "test_access_setup")
      .eq("dispatch_token", data.token)
      .eq("status", "cancelled")
      .maybeSingle();

    if (setupError || !setupRow) throw new Error("Token inválido ou expirado.");

    async function ensureProfile(email: string, nome: string, tipo: "gestor" | "azumi", filial: "champagnat" | null) {
      const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) throw listError;
      let user = listed.users.find((u) => u.email === email);

      if (!user) {
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email,
          password: TEST_PASSWORD,
          email_confirm: true,
          user_metadata: { test_account: true, kentaki_role: tipo },
        });
        if (createError || !created.user) throw createError ?? new Error("Usuário não criado.");
        user = created.user;
      } else {
        const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(user.id, {
          password: TEST_PASSWORD,
          email_confirm: true,
          user_metadata: { ...(user.user_metadata ?? {}), test_account: true, kentaki_role: tipo },
          ban_duration: "none",
        });
        if (updateError || !updated.user) throw updateError ?? new Error("Usuário não atualizado.");
        user = updated.user;
      }

      const { error: profileError } = await admin.from("kt_perfis").upsert({
        id: user.id,
        tipo,
        filial,
        nome,
        precisa_trocar_senha: false,
        ativo: true,
        updated_at: new Date().toISOString(),
      });
      if (profileError) throw profileError;
      return user.id;
    }

    await ensureProfile("patricia+gestor.teste@azumirh.com.br", "GESTOR TESTE", "gestor", "champagnat");
    await ensureProfile("patricia+rh.teste@azumirh.com.br", "RH TESTE", "azumi", null);

    const { error: colabError } = await admin.from("kt_colaboradores").upsert({
      id: "colab-teste-ux",
      nome: "COLABORADOR TESTE",
      cpf3: "777",
      cargo: "Atendente",
      filial: "champagnat",
      nascimento: "1995-08-28",
      admissao: "2026-01-10",
      ativo: true,
      motivo_desligamento: null,
      desligado_em: null,
      desligado_por: null,
      updated_at: new Date().toISOString(),
    });
    if (colabError) throw colabError;

    await admin.from("kt_email_outbox").delete().eq("id", setupRow.id);

    return {
      ok: true,
      gestor: "patricia+gestor.teste@azumirh.com.br",
      rh: "patricia+rh.teste@azumirh.com.br",
      senha: TEST_PASSWORD,
      colaborador: { nome: "COLABORADOR TESTE", filial: "champagnat", cpf3: "777" },
    };
  });

export const Route = createFileRoute("/setup-test-access")({ component: SetupTestAccess });

function SetupTestAccess() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-bold">Provisionar acessos de teste</h1>
      <div className="mt-5 grid gap-3">
        <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token temporário" />
        <Button
          onClick={async () => {
            setStatus("Processando...");
            try {
              await provisionTestAccessFn({ data: { token } });
              setStatus("OK");
            } catch (e) {
              setStatus((e as Error).message);
            }
          }}
        >
          Criar acessos
        </Button>
        <p>{status}</p>
      </div>
    </main>
  );
}
