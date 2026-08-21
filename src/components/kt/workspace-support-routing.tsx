import { LifeBuoy, UserRoundCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { filialNome } from "@/lib/kt-data";
import { listarGestoresFn } from "@/lib/server-fns";
import { supabase } from "@/lib/supabase";

type Mode = "manager" | "hr";

type Profile = {
  id: string;
  nome: string;
  tipo: string;
  filial: string | null;
};

type SupportRow = {
  id: string;
  nome: string;
  filial: string;
  assunto: string | null;
  ts: string;
  status: string | null;
  destino_inicial: string | null;
  gestor_id: string | null;
  rh_solicitado: boolean | null;
};

type ManagerRow = {
  id: string;
  nome: string;
  filial: string | null;
};

function formatWhen(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function assuntoLabel(item: SupportRow) {
  if (item.destino_inicial === "gestor") return "Pedido direto à liderança";
  if (item.gestor_id) return "Encaminhado pelo RH";
  return "Acompanhamento confidencial do RH";
}

export function WorkspaceSupportRouting({ mode }: { mode: Mode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [supports, setSupports] = useState<SupportRow[]>([]);
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [selectedManager, setSelectedManager] = useState<Record<string, string>>({});
  const [workingId, setWorkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const { data: p, error: profileError } = await supabase
      .from("kt_perfis")
      .select("id,nome,tipo,filial")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profileError || !p) return;

    const current = p as Profile;
    setProfile(current);

    if (mode === "hr") {
      const [supportResult, managerResult] = await Promise.all([
        supabase
          .from("kt_ajuda")
          .select("id,nome,filial,assunto,ts,status,destino_inicial,gestor_id,rh_solicitado")
          .or("status.is.null,status.neq.resolvido")
          .order("ts", { ascending: false })
          .limit(30),
        listarGestoresFn(),
      ]);
      setSupports((supportResult.data ?? []) as SupportRow[]);
      setManagers(
        managerResult
          .filter((manager) => manager.ativo && manager.filial)
          .map((manager) => ({ id: manager.id, nome: manager.nome, filial: manager.filial })),
      );
      return;
    }

    if (!current.filial) return;
    const { data } = await supabase
      .from("kt_ajuda")
      .select("id,nome,filial,assunto,ts,status,destino_inicial,gestor_id,rh_solicitado")
      .eq("filial", current.filial)
      .or(`destino_inicial.eq.gestor,gestor_id.eq.${current.id}`)
      .order("ts", { ascending: false })
      .limit(20);
    setSupports(((data ?? []) as SupportRow[]).filter((item) => item.status !== "resolvido"));
  }, [mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const managersById = useMemo(
    () => new Map(managers.map((manager) => [manager.id, manager])),
    [managers],
  );

  const assignManager = async (support: SupportRow) => {
    const managerId = selectedManager[support.id];
    if (!managerId) {
      toast.error("Selecione o gestor que deve acompanhar este pedido.");
      return;
    }

    setWorkingId(support.id);
    try {
      const { error } = await supabase.rpc("kt_envolver_gestor_apoio", {
        p_pedido_id: support.id,
        p_gestor_id: managerId,
      });
      if (error) throw error;
      toast.success("Gestor envolvido e notificado.");
      await load();
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível envolver o gestor.");
    } finally {
      setWorkingId(null);
    }
  };

  const escalateToHr = async (support: SupportRow) => {
    setWorkingId(support.id);
    try {
      const { error } = await supabase.rpc("kt_escalar_apoio_rh", {
        p_pedido_id: support.id,
      });
      if (error) throw error;
      toast.success("RH acionado e notificado para acompanhar este pedido.");
      await load();
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível acionar o RH.");
    } finally {
      setWorkingId(null);
    }
  };

  if (!profile || supports.length === 0) return null;

  if (mode === "manager") {
    return (
      <section
        id="apoio"
        className="mb-5 scroll-mt-24 overflow-hidden rounded-lg border border-border bg-card"
        aria-label="Pedidos de conversa da gestão"
      >
        <div className="flex items-start gap-3 border-b border-border px-4 py-3.5 sm:px-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-foreground">
            <LifeBuoy className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-foreground">Pedidos de conversa em acompanhamento</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              O RH já acompanha todos os registros. Use a ação abaixo quando você precisar de atuação direta do RH neste caso.
            </p>
          </div>
        </div>
        <div className="divide-y divide-border">
          {supports.slice(0, 6).map((item) => (
            <div key={item.id} className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{item.nome}</p>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{assuntoLabel(item)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{filialNome(item.filial)} · {formatWhen(item.ts)}</p>
              </div>
              <div className="flex items-center gap-2 lg:justify-end">
                {item.rh_solicitado ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-success-soft px-2.5 py-1.5 text-[11px] font-semibold text-success">
                    <UserRoundCheck className="h-3.5 w-3.5" /> RH acionado
                  </span>
                ) : (
                  <Button variant="outline" size="sm" disabled={workingId === item.id} onClick={() => void escalateToHr(item)}>
                    Solicitar atuação do RH
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      id="apoio"
      className="mb-5 scroll-mt-24 overflow-hidden rounded-lg border border-border bg-card"
      aria-label="Encaminhamento de pedidos de apoio pelo RH"
    >
      <div className="flex items-start gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-kt-soft text-kt">
          <UserRoundCheck className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-bold text-foreground">Encaminhamento de pedidos de apoio</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            O RH mantém a visão do caso. Quando fizer sentido envolver a liderança, escolha o gestor da mesma unidade e faça o encaminhamento por aqui.
          </p>
        </div>
      </div>
      <div className="divide-y divide-border">
        {supports.slice(0, 8).map((item) => {
          const assigned = item.gestor_id ? managersById.get(item.gestor_id) : undefined;
          const eligible = managers.filter((manager) => manager.filial === item.filial);
          return (
            <div key={item.id} className="grid gap-3 px-4 py-4 sm:px-5 xl:grid-cols-[minmax(0,1fr)_minmax(220px,300px)_auto] xl:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{item.nome}</p>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {item.destino_inicial === "gestor" ? "Colaborador pediu liderança" : "Entrada pelo RH"}
                  </span>
                  {item.rh_solicitado ? (
                    <span className="rounded-md bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">Gestor pediu apoio do RH</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{filialNome(item.filial)} · {formatWhen(item.ts)}</p>
              </div>

              {assigned ? (
                <div className="rounded-md bg-muted/55 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Gestor envolvido:</span>{" "}
                  <strong className="text-foreground">{assigned.nome}</strong>
                </div>
              ) : (
                <select
                  value={selectedManager[item.id] ?? ""}
                  onChange={(event) => setSelectedManager((previous) => ({ ...previous, [item.id]: event.target.value }))}
                  className="h-9 w-full rounded-md border border-border bg-card px-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/20"
                >
                  <option value="">Selecionar gestor da unidade</option>
                  {eligible.map((manager) => (
                    <option key={manager.id} value={manager.id}>{manager.nome}</option>
                  ))}
                </select>
              )}

              <div className="xl:text-right">
                {assigned ? (
                  <span className="text-[11px] font-semibold text-success">Notificado e em acompanhamento</span>
                ) : eligible.length === 0 ? (
                  <span className="text-[11px] font-semibold text-warn">Nenhum gestor ativo nesta unidade</span>
                ) : (
                  <Button size="sm" disabled={workingId === item.id || !selectedManager[item.id]} onClick={() => void assignManager(item)}>
                    Envolver gestor
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
