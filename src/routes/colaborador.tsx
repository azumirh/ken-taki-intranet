import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { AppShell, BackLink } from "@/components/kt/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FILIAIS } from "@/lib/kt-data";
import { useSession } from "@/lib/kt-store";
import { criarSessaoColaboradorFn } from "@/lib/employee-server-fns";
import { saveEmployeeAccess } from "@/lib/employee-session";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/colaborador")({
  head: () => ({
    meta: [
      { title: "Acesso do colaborador · Ken Taki" },
      {
        name: "description",
        content: "Acesse seu portal interno Ken Taki de forma simples e segura.",
      },
    ],
  }),
  component: ColaboradorLogin,
});

function ColaboradorLogin() {
  const navigate = useNavigate();
  const [, setSession] = useSession();
  const [filial, setFilial] = useState<"cristo-rei" | "champagnat" | "">("");
  const [nome, setNome] = useState("");
  const [cpf3, setCpf3] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const entrar = async () => {
    setErro("");
    if (!filial) return setErro("Selecione sua unidade.");
    if (nome.trim().length < 3) return setErro("Informe seu nome completo.");
    if (!/^\d{3}$/.test(cpf3)) return setErro("Informe os 3 últimos dígitos do CPF.");

    setCarregando(true);
    try {
      const resultado = await criarSessaoColaboradorFn({ data: { nome, cpf3, filial } });
      if (!resultado.ok) {
        setErro("Não encontramos esses dados. Confira unidade, nome e CPF e tente novamente.");
        return;
      }

      const { error: authError } = await supabase.auth.setSession({
        access_token: resultado.supabaseSession.accessToken,
        refresh_token: resultado.supabaseSession.refreshToken,
      });
      if (authError) throw authError;

      saveEmployeeAccess(resultado.access);
      setSession({
        tipo: "colaborador",
        nome: resultado.access.nome,
        cpf3,
        filial: resultado.access.filial,
      });
      navigate({ to: "/painel" });
    } catch {
      setErro("Não foi possível validar seu acesso agora. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <AppShell back={<BackLink onClick={() => navigate({ to: "/" })}>Voltar ao início</BackLink>}>
      <div className="mx-auto grid w-full max-w-[980px] overflow-hidden rounded-xl border border-[#5c294f]/15 bg-card shadow-[var(--shadow-lift)] lg:grid-cols-[0.88fr_1.12fr]">
        <aside className="relative overflow-hidden bg-[#4b1736] px-6 py-8 text-white sm:px-8 lg:min-h-[590px] lg:px-9 lg:py-10">
          <div className="absolute -right-20 -top-16 h-64 w-64 rounded-full bg-[#9a456b]/25 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-black/20 blur-3xl" />
          <div className="relative flex h-full flex-col">
            <div className="inline-flex items-center gap-3">
              <span className="text-lg font-black tracking-[0.08em]">KEN TAKI</span>
              <span className="h-5 w-px bg-white/25" aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                Intranet
              </span>
            </div>

            <div className="mt-12 max-w-sm lg:mt-auto lg:mb-auto">
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-white/10 text-[#f0cbd9]">
                <UserRound className="h-5 w-5" />
              </span>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#e9c5d5]">
                Acesso do colaborador
              </p>
              <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">
                Entre no seu espaço.
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-white/68 sm:text-base">
                Use os mesmos dados do seu cadastro. Você não precisa criar senha nem passar por
                várias etapas.
              </p>
            </div>

            <div className="mt-8 hidden items-start gap-2 border-t border-white/12 pt-5 text-xs leading-relaxed text-white/55 lg:flex">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#e9c5d5]" />
              <span>Os dados são validados no servidor e usados apenas para localizar seu cadastro.</span>
            </div>
          </div>
        </aside>

        <section className="px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
          <div className="max-w-lg">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7a3049]">
              Identificação
            </p>
            <h2 className="mt-2 text-2xl font-extrabold text-foreground sm:text-3xl">
              Confirme seus dados
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Preencha os três campos abaixo para acessar sua área do Ken Taki.
            </p>
          </div>

          <div className="mt-7 grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="filial">Onde você trabalha?</Label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a3049]" />
                <select
                  id="filial"
                  value={filial}
                  onChange={(event) => {
                    setFilial(event.target.value as "cristo-rei" | "champagnat" | "");
                    setErro("");
                  }}
                  className="h-11 w-full appearance-none rounded-md border border-input bg-background pl-10 pr-10 text-sm font-medium outline-none transition-colors focus:border-[#7a3049] focus:ring-2 focus:ring-[#7a3049]/15"
                >
                  <option value="">Selecione sua unidade</option>
                  {FILIAIS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  ▾
                </span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                maxLength={80}
                autoComplete="name"
                placeholder="Como aparece no seu cadastro"
                className="h-11"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cpf">3 últimos dígitos do CPF</Label>
              <Input
                id="cpf"
                inputMode="numeric"
                maxLength={3}
                value={cpf3}
                onChange={(event) => setCpf3(event.target.value.replace(/\D/g, ""))}
                className="h-11 max-w-40 text-center text-lg tracking-[0.32em]"
                autoComplete="off"
                placeholder="000"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !carregando) void entrar();
                }}
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Usamos apenas estes três dígitos para confirmar o cadastro. O CPF não funciona como
                senha.
              </p>
            </div>

            {erro ? (
              <p className="rounded-md border border-destructive/15 bg-destructive/5 px-3.5 py-3 text-sm font-medium text-destructive">
                {erro}
              </p>
            ) : null}

            <Button
              size="lg"
              className="mt-1 h-12 w-full bg-[#4b1736] text-white hover:bg-[#351526]"
              onClick={() => void entrar()}
              disabled={carregando}
            >
              {carregando ? "Validando acesso..." : "Acessar meu portal"}
            </Button>

            <div className="flex items-start gap-2 rounded-lg bg-[#f4e9ed] px-3.5 py-3 text-xs leading-relaxed text-[#6c2444]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Seu acesso é individual. As informações exibidas respeitam sua unidade e as regras
                de confidencialidade da plataforma.
              </span>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
