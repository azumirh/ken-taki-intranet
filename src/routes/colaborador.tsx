import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, Check, ShieldCheck, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AppShell, BackLink } from "@/components/kt/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FILIAIS } from "@/lib/kt-data";
import { useSession } from "@/lib/kt-store";
import { criarSessaoColaboradorFn } from "@/lib/employee-server-fns";
import { saveEmployeeAccess } from "@/lib/employee-session";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/colaborador")({
  head: () => ({
    meta: [
      { title: "Acesso do colaborador · Ken Taki" },
      { name: "description", content: "Acesse seu portal interno Ken Taki de forma simples e segura." },
    ],
  }),
  component: ColaboradorLogin,
});

function Step({ active, done, number, children }: { active: boolean; done: boolean; number: number; children: ReactNode }) {
  return (
    <div className={`flex items-center gap-2 text-xs font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}>
      <span className={`grid h-6 w-6 place-items-center rounded-full border text-[11px] ${done ? "border-success bg-success text-white" : active ? "border-kt bg-kt text-white" : "border-border bg-card"}`}>
        {done ? <Check className="h-3.5 w-3.5" /> : number}
      </span>
      {children}
    </div>
  );
}

function ColaboradorLogin() {
  const navigate = useNavigate();
  const [, setSession] = useSession();
  const [etapa, setEtapa] = useState<0 | 1>(0);
  const [filial, setFilial] = useState<"cristo-rei" | "champagnat" | "">("");
  const [nome, setNome] = useState("");
  const [cpf3, setCpf3] = useState("");
  const [ciente, setCiente] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const entrar = async () => {
    setErro("");
    if (!filial) return setErro("Selecione sua unidade.");
    if (nome.trim().length < 3) return setErro("Informe seu nome completo.");
    if (!/^\d{3}$/.test(cpf3)) return setErro("Informe os 3 últimos dígitos do CPF.");
    if (!ciente) return setErro("Confirme sua identidade para continuar.");

    setCarregando(true);
    try {
      const resultado = await criarSessaoColaboradorFn({ data: { nome, cpf3, filial } });
      if (!resultado.ok) {
        setErro("Não encontramos esses dados nesta unidade. Confira e tente novamente.");
        return;
      }

      const { error: authError } = await supabase.auth.setSession({
        access_token: resultado.supabaseSession.accessToken,
        refresh_token: resultado.supabaseSession.refreshToken,
      });
      if (authError) throw authError;

      saveEmployeeAccess(resultado.access);
      setSession({ tipo: "colaborador", nome: resultado.access.nome, cpf3, filial: resultado.access.filial });
      navigate({ to: "/painel" });
    } catch {
      setErro("Não foi possível validar seu acesso agora. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <AppShell
      back={
        <BackLink onClick={() => (etapa === 1 ? setEtapa(0) : navigate({ to: "/" }))}>
          {etapa === 1 ? "Voltar para unidade" : "Voltar ao início"}
        </BackLink>
      }
    >
      <div className="mx-auto w-full max-w-[620px]">
        <div className="mb-5 flex items-center justify-between gap-4 px-1">
          <Step active={etapa === 0} done={etapa > 0} number={1}>Unidade</Step>
          <div className="h-px flex-1 bg-border" />
          <Step active={etapa === 1} done={false} number={2}>Identificação</Step>
        </div>

        {etapa === 0 ? (
          <section className="surface overflow-hidden">
            <div className="border-b border-border px-5 py-5 sm:px-6">
              <span className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-kt-soft text-kt">
                <Building2 className="h-5 w-5" />
              </span>
              <h1 className="text-2xl font-bold">Onde você trabalha?</h1>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Escolha sua unidade para acessar apenas os conteúdos e documentos corretos.
              </p>
            </div>

            <div className="grid gap-2 p-3 sm:p-4">
              {FILIAIS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setFilial(f.id as "cristo-rei" | "champagnat");
                    setEtapa(1);
                    setErro("");
                  }}
                  className="group flex min-h-[74px] items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:border-kt/50 hover:bg-kt-soft/35"
                >
                  <span>
                    <span className="block text-sm font-bold text-foreground">{f.nome}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{f.descricao}</span>
                  </span>
                  <span className="text-lg text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-kt">→</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="surface overflow-hidden">
            <div className="border-b border-border px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-kt-soft text-kt">
                  <UserRound className="h-5 w-5" />
                </span>
                <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  {FILIAIS.find((f) => f.id === filial)?.nome}
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-bold">Confirme sua identificação</h1>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Usamos estes dados apenas para localizar seu cadastro e abrir sua sessão com segurança.
              </p>
            </div>

            <div className="grid gap-5 p-5 sm:p-6">
              <div className="grid gap-2">
                <Label htmlFor="nome">Nome completo</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} autoComplete="name" placeholder="Como aparece no seu cadastro" className="h-11" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cpf">3 últimos dígitos do CPF</Label>
                <Input
                  id="cpf"
                  inputMode="numeric"
                  maxLength={3}
                  value={cpf3}
                  onChange={(e) => setCpf3(e.target.value.replace(/\D/g, ""))}
                  className="h-11 w-32 text-center text-lg tracking-[0.32em]"
                  autoComplete="off"
                  placeholder="000"
                  onKeyDown={(e) => { if (e.key === "Enter" && !carregando) void entrar(); }}
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/35 px-4 py-3.5 text-sm">
                <Checkbox checked={ciente} onCheckedChange={(v) => setCiente(v === true)} className="mt-0.5" />
                <span className="leading-relaxed text-muted-foreground">
                  Confirmo que sou a pessoa deste cadastro e autorizo a consulta dos meus registros pelas pessoas responsáveis, conforme as regras de acesso da plataforma.
                </span>
              </label>

              <div className="flex items-start gap-2 rounded-lg bg-success-soft px-3.5 py-3 text-xs leading-relaxed text-success">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Seu CPF não é usado como senha. A validação ocorre no servidor e a sessão é protegida.</span>
              </div>

              {erro ? <p className="rounded-lg bg-destructive/5 px-3.5 py-3 text-sm font-medium text-destructive">{erro}</p> : null}

              <Button size="lg" className="h-11 w-full" onClick={() => void entrar()} disabled={carregando}>
                {carregando ? "Validando acesso..." : "Acessar meu portal"}
              </Button>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
