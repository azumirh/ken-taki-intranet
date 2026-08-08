import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/kt/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Criar nova senha · Portal Azumi RH" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [fase, setFase] = useState<"trocando" | "feito" | "erro">("trocando");
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // PKCE flow: ?code= in query params (email recovery via resetPasswordForEmail)
    const code = new URL(window.location.href).searchParams.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) setFase("erro");
        setCarregando(false);
      });
      return;
    }

    // Implicit/OTP flow (admin-generated links, older Supabase clients):
    // Supabase JS auto-processes the #access_token hash before this effect runs
    // and fires PASSWORD_RECOVERY via onAuthStateChange. Check if session exists.
    let settled = false;
    const settle = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (!ok) setFase("erro");
      setCarregando(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") settle(true);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        settle(true);
      } else {
        setTimeout(() => settle(false), 1500);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (carregando) return null;

  if (fase === "erro") {
    return (
      <AppShell>
        <div className="surface mx-auto max-w-md p-6 text-center sm:p-8">
          <p className="text-3xl">⏰</p>
          <h1 className="mt-3 text-xl font-bold">Link expirado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este link de recuperação já foi usado ou expirou. Solicite um novo pelo login.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button asChild className="rounded-full">
              <Link to="/gestor">Login do gestor</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/azumi">Login da Azumi</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (fase === "feito") {
    return (
      <AppShell>
        <div className="surface mx-auto max-w-md p-6 text-center sm:p-8">
          <p className="text-3xl">✅</p>
          <h1 className="mt-3 text-xl font-bold">Senha atualizada!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua nova senha já está ativa. Faça login para continuar.
          </p>
          <Button className="mt-5 rounded-full" onClick={() => navigate({ to: "/" })}>
            Ir para o início
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="surface mx-auto max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold">Criar nova senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Digite e confirme a sua nova senha de acesso.
        </p>
        <div className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="nova">Nova senha</Label>
            <Input
              id="nova"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="conf">Confirmar nova senha</Label>
            <Input
              id="conf"
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
            />
          </div>
          {erro ? <p className="text-sm font-medium text-destructive">{erro}</p> : null}
          <Button
            size="lg"
            className="w-full rounded-full"
            disabled={senha.length < 8 || enviando}
            onClick={async () => {
              if (senha !== confirmar) {
                setErro("As senhas não coincidem.");
                return;
              }
              setEnviando(true);
              setErro("");
              const { error: errUpd } = await supabase.auth.updateUser({ password: senha });
              if (errUpd) {
                setErro(errUpd.message);
                setEnviando(false);
                return;
              }
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (user) {
                await supabase
                  .from("kt_perfis")
                  .update({ precisa_trocar_senha: false, updated_at: new Date().toISOString() })
                  .eq("id", user.id);
              }
              await supabase.auth.signOut();
              setFase("feito");
            }}
          >
            {enviando ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
