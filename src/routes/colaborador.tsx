import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, BackLink } from "@/components/kt/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FILIAIS } from "@/lib/kt-data";
import { useSession } from "@/lib/kt-store";
import { criarSessaoColaboradorFn } from "@/lib/employee-server-fns";
import { saveEmployeeAccess } from "@/lib/employee-session";

export const Route = createFileRoute("/colaborador")({
  head: () => ({
    meta: [
      { title: "Entrar como colaborador · Ken Taki" },
      {
        name: "description",
        content:
          "Acesse a intranet do Ken Taki com seu nome, sua filial e os 3 últimos dígitos do CPF.",
      },
      { property: "og:title", content: "Entrar como colaborador · Ken Taki" },
      {
        property: "og:description",
        content: "Acesso rápido do colaborador à intranet do Ken Taki.",
      },
    ],
  }),
  component: ColaboradorLogin,
});

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
    if (nome.trim().length < 3) return setErro("Escreva seu nome completo.");
    if (!/^\d{3}$/.test(cpf3)) return setErro("Informe os 3 últimos dígitos do seu CPF.");
    if (!ciente) return setErro("Confirme que é você mesmo para continuar.");

    setCarregando(true);
    try {
      const resultado = await criarSessaoColaboradorFn({
        data: { nome, cpf3, filial },
      });

      if (!resultado.ok) {
        setErro("Nome ou CPF não encontrados nesta unidade.");
        return;
      }

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
    <AppShell
      back={
        <BackLink onClick={() => (etapa === 1 ? setEtapa(0) : navigate({ to: "/" }))}>
          {etapa === 1 ? "trocar filial" : "voltar ao início"}
        </BackLink>
      }
    >
      <div className="mx-auto w-full max-w-lg">
        {etapa === 0 ? (
          <div className="surface p-6 sm:p-8">
            <h1 className="text-2xl font-extrabold">Qual é a sua unidade?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecione a filial em que você trabalha hoje.
            </p>
            <div className="mt-6 grid gap-3">
              {FILIAIS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setFilial(f.id as "cristo-rei" | "champagnat");
                    setEtapa(1);
                    setErro("");
                  }}
                  className="rounded-2xl border border-border bg-card px-5 py-4 text-left transition-colors hover:border-kt hover:bg-kt-soft"
                >
                  <span className="block font-semibold">{f.nome}</span>
                  <span className="block text-sm text-muted-foreground">{f.descricao}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="surface p-6 sm:p-8">
            <h1 className="text-2xl font-extrabold">Só pra te identificar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Unidade {FILIAIS.find((f) => f.id === filial)?.nome}. A validação acontece de forma
              segura e seus dados não são usados como senha.
            </p>
            <div className="mt-6 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="nome">Seu nome completo</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  maxLength={80}
                  autoComplete="name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cpf">Últimos 3 dígitos do CPF</Label>
                <Input
                  id="cpf"
                  inputMode="numeric"
                  maxLength={3}
                  value={cpf3}
                  onChange={(e) => setCpf3(e.target.value.replace(/\D/g, ""))}
                  className="w-28 tracking-[0.4em]"
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !carregando) void entrar();
                  }}
                />
              </div>
              <label className="flex items-start gap-3 rounded-xl bg-muted px-4 py-3 text-sm">
                <Checkbox
                  checked={ciente}
                  onCheckedChange={(v) => setCiente(v === true)}
                  className="mt-0.5"
                />
                <span className="text-muted-foreground">
                  Confirmo que sou eu e que meus registros podem ser consultados pela liderança
                  autorizada e pelo RH.
                </span>
              </label>
              {erro ? <p className="text-sm font-medium text-destructive">{erro}</p> : null}
              <Button
                size="lg"
                className="w-full rounded-full"
                onClick={() => void entrar()}
                disabled={carregando}
              >
                {carregando ? "Validando..." : "Entrar na intranet"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
