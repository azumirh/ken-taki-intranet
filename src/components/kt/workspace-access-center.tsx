import { KeyRound, Pencil, Shield, ShieldCheck, UserPlus2, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminPermissions, type AdminPermission, type AdminSection } from "@/lib/admin-permissions";
import { criarAdminRhFn, atualizarAcessoGerenciadoFn, desativarAcessoGerenciadoFn } from "@/lib/admin-server-fns";
import { criarGestorFn, listarGestoresFn } from "@/lib/server-fns";
import { filialNome } from "@/lib/kt-data";
import { supabase } from "@/lib/supabase";

const SECTION_LABELS: Array<[AdminSection, string]> = [
  ["dashboard", "Visão geral"],
  ["feedbacks", "Feedbacks e triagem"],
  ["apoio", "Pedidos de apoio"],
  ["casos", "Central de Casos"],
  ["offboarding", "Desligamentos"],
  ["vagas", "Solicitações de vaga"],
  ["reconhecimento", "Reconhecimentos"],
  ["onboarding", "Onboarding e experiência"],
  ["clima", "Clima"],
  ["noticias", "Notícias e vídeos"],
  ["pesquisas", "Pesquisas"],
  ["mural", "Mural"],
  ["sugestoes", "Sugestões"],
  ["colaboradores", "Colaboradores"],
  ["documentos", "Documentos"],
  ["acessos", "Acessos"],
];

type AdminRow = {
  id: string;
  nome: string;
  email: string;
  admin_nivel: "geral" | "parcial";
  ativo: boolean;
  created_at: string;
};

type ManagerRow = {
  id: string;
  nome: string;
  email: string;
  filial: string | null;
  ativo: boolean;
  created_at: string;
};

function initialPermissions(): AdminPermission[] {
  return SECTION_LABELS.map(([section]) => ({
    section,
    canView: section !== "acessos",
    canEdit: false,
    canDelete: false,
  }));
}

function PermissionMatrix({ value, onChange }: { value: AdminPermission[]; onChange: (next: AdminPermission[]) => void }) {
  const update = (section: AdminSection, key: "canView" | "canEdit" | "canDelete", checked: boolean) => {
    onChange(
      value.map((item) => {
        if (item.section !== section) return item;
        const next = { ...item, [key]: checked };
        if ((key === "canEdit" || key === "canDelete") && checked) next.canView = true;
        if (key === "canView" && !checked) {
          next.canEdit = false;
          next.canDelete = false;
        }
        return next;
      }),
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-[minmax(150px,1fr)_76px_76px_76px] border-b border-border bg-muted/55 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        <span>Sessão</span><span className="text-center">Ver</span><span className="text-center">Editar</span><span className="text-center">Excluir</span>
      </div>
      {SECTION_LABELS.map(([section, label]) => {
        const item = value.find((permission) => permission.section === section)!;
        return (
          <div key={section} className="grid grid-cols-[minmax(150px,1fr)_76px_76px_76px] items-center border-b border-border px-3 py-2.5 last:border-0">
            <span className="text-xs font-semibold text-foreground">{label}</span>
            {(["canView", "canEdit", "canDelete"] as const).map((key) => (
              <label key={key} className="grid place-items-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--profile-accent,var(--kt))]"
                  checked={item[key]}
                  onChange={(event) => update(section, key, event.target.checked)}
                />
              </label>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function WorkspaceAccessCenter() {
  const { level, can } = useAdminPermissions();
  const [tab, setTab] = useState<"rh" | "gestores">("rh");
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<"rh" | "gestor">("rh");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [nivel, setNivel] = useState<"geral" | "parcial">("parcial");
  const [filial, setFilial] = useState<"cristo-rei" | "champagnat">("champagnat");
  const [permissions, setPermissions] = useState(initialPermissions());
  const [saving, setSaving] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminRow | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<AdminPermission[]>(initialPermissions());
  const [editingManager, setEditingManager] = useState<ManagerRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editFilial, setEditFilial] = useState<"cristo-rei" | "champagnat">("champagnat");
  const [lastCredential, setLastCredential] = useState<{ email: string; password: string; emailSent: boolean } | null>(null);

  const load = useCallback(async () => {
    if (level !== "geral") return;
    setLoading(true);
    try {
      const [adminResult, managerResult] = await Promise.all([
        supabase.rpc("kt_list_admin_accounts"),
        listarGestoresFn(),
      ]);
      if (adminResult.error) throw adminResult.error;
      setAdmins((adminResult.data ?? []) as AdminRow[]);
      setManagers(managerResult as ManagerRow[]);
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível carregar os acessos.");
    } finally {
      setLoading(false);
    }
  }, [level]);

  useEffect(() => { void load(); }, [load]);

  const currentUserId = useMemo(() => admins.find((item) => item.admin_nivel === "geral" && item.nome)?.id, [admins]);

  if (!can("acessos", "view")) return null;

  if (level !== "geral") {
    return (
      <section id="acessos" className="surface scroll-mt-24 p-5">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 text-kt" />
          <div><h2 className="text-lg font-bold">Acessos administrativos</h2><p className="mt-1 text-sm text-muted-foreground">Seu perfil é Administrador parcial. A criação e alteração de acessos fica restrita ao Administrador geral.</p></div>
        </div>
      </section>
    );
  }

  async function token() {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error("Sessão expirada. Entre novamente.");
    return accessToken;
  }

  async function createAccess() {
    setSaving(true);
    setLastCredential(null);
    try {
      if (createKind === "rh") {
        const result = await criarAdminRhFn({ data: {
          accessToken: await token(), nome, email, nivel,
          permissions: nivel === "parcial" ? permissions.map((item) => ({ section: item.section, can_view: item.canView, can_edit: item.canEdit, can_delete: item.canDelete })) : [],
        }});
        setLastCredential({ email: result.email, password: result.senhaTemp, emailSent: result.emailEnviado });
      } else {
        const result = await criarGestorFn({ data: { nome, email, filial } });
        setLastCredential({ email: email.trim().toLowerCase(), password: result.senhaTemp, emailSent: result.emailEnviado });
      }
      toast.success("Acesso criado.");
      await load();
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível criar o acesso.");
    } finally { setSaving(false); }
  }

  async function openAdminPermissions(row: AdminRow) {
    setEditingAdmin(row);
    const { data } = await supabase.from("kt_admin_permissions").select("section,can_view,can_edit,can_delete").eq("profile_id", row.id);
    const bySection = new Map((data ?? []).map((item) => [item.section, item]));
    setEditingPermissions(SECTION_LABELS.map(([section]) => {
      const item = bySection.get(section);
      return { section, canView: Boolean(item?.can_view), canEdit: Boolean(item?.can_edit), canDelete: Boolean(item?.can_delete) };
    }));
  }

  async function saveAdminPermissions() {
    if (!editingAdmin) return;
    setSaving(true);
    try {
      await supabase.rpc("kt_set_admin_level", { p_profile_id: editingAdmin.id, p_level: editingAdmin.admin_nivel });
      if (editingAdmin.admin_nivel === "parcial") {
        const { error } = await supabase.rpc("kt_set_admin_permissions", {
          p_profile_id: editingAdmin.id,
          p_permissions: editingPermissions.map((item) => ({ section: item.section, can_view: item.canView, can_edit: item.canEdit, can_delete: item.canDelete })),
        });
        if (error) throw error;
      }
      toast.success("Permissões atualizadas.");
      setEditingAdmin(null);
      await load();
    } catch (error) { toast.error((error as Error).message); }
    finally { setSaving(false); }
  }

  async function saveManager() {
    if (!editingManager) return;
    setSaving(true);
    try {
      await atualizarAcessoGerenciadoFn({ data: { accessToken: await token(), userId: editingManager.id, nome: editName, email: editEmail, filial: editFilial } });
      toast.success("Acesso do gestor atualizado.");
      setEditingManager(null);
      await load();
    } catch (error) { toast.error((error as Error).message); }
    finally { setSaving(false); }
  }

  async function deactivate(id: string, name: string) {
    if (!confirm(`Desativar o acesso de ${name}? O histórico será preservado.`)) return;
    try {
      await desativarAcessoGerenciadoFn({ data: { accessToken: await token(), userId: id } });
      toast.success("Acesso desativado e histórico preservado.");
      await load();
    } catch (error) { toast.error((error as Error).message); }
  }

  return (
    <section id="acessos" className="surface scroll-mt-24 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-kt" /><h2 className="text-lg font-bold">Acessos e permissões</h2></div><p className="mt-1 text-sm text-muted-foreground">Administrador geral controla quem entra no RH e exatamente o que cada acesso parcial pode visualizar, editar ou excluir.</p></div>
        <Button onClick={() => { setCreateOpen(true); setLastCredential(null); setNome(""); setEmail(""); setPermissions(initialPermissions()); }}><UserPlus2 className="h-4 w-4" /> Criar acesso</Button>
      </div>

      <div className="flex gap-1 border-b border-border bg-muted/30 px-5 pt-3 lg:px-6">
        {(["rh", "gestores"] as const).map((value) => <button key={value} onClick={() => setTab(value)} className={`border-b-2 px-4 py-2.5 text-xs font-bold ${tab === value ? "border-kt text-kt" : "border-transparent text-muted-foreground"}`}>{value === "rh" ? `Administrativo RH (${admins.length})` : `Gestores (${managers.length})`}</button>)}
      </div>

      <div className="p-5 lg:p-6">
        {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Carregando acessos...</p> : tab === "rh" ? (
          <div className="grid gap-2">
            {admins.map((row) => (
              <div key={row.id} className="grid gap-3 rounded-lg border border-border bg-card px-4 py-3.5 lg:grid-cols-[minmax(180px,1fr)_minmax(220px,1.2fr)_150px_110px_auto] lg:items-center">
                <div><p className="font-semibold">{row.nome}</p><p className="text-[11px] text-muted-foreground">Criado em {new Date(row.created_at).toLocaleDateString("pt-BR")}</p></div>
                <p className="break-all text-sm text-muted-foreground">{row.email}</p>
                <span className={`w-fit rounded-md px-2.5 py-1 text-xs font-bold ${row.admin_nivel === "geral" ? "bg-kt text-white" : "bg-muted text-foreground"}`}>{row.admin_nivel === "geral" ? "Administrador geral" : "Administrador parcial"}</span>
                <span className={`text-xs font-semibold ${row.ativo ? "text-success" : "text-destructive"}`}>{row.ativo ? "Ativo" : "Desativado"}</span>
                <div className="flex flex-wrap gap-2 lg:justify-end"><Button variant="outline" size="sm" onClick={() => void openAdminPermissions(row)}><KeyRound className="h-3.5 w-3.5" /> Permissões</Button>{row.ativo && row.id !== currentUserId ? <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void deactivate(row.id,row.nome)}>Desativar</Button> : null}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-2">
            {managers.map((row) => (
              <div key={row.id} className="grid gap-3 rounded-lg border border-border bg-card px-4 py-3.5 lg:grid-cols-[minmax(180px,1fr)_minmax(230px,1.2fr)_150px_110px_auto] lg:items-center">
                <div><p className="font-semibold">{row.nome}</p><p className="text-[11px] text-muted-foreground">Criado em {new Date(row.created_at).toLocaleDateString("pt-BR")}</p></div>
                <p className="break-all text-sm text-muted-foreground">{row.email}</p>
                <span className="text-sm">{filialNome(row.filial ?? undefined)}</span><span className={`text-xs font-semibold ${row.ativo ? "text-success" : "text-destructive"}`}>{row.ativo ? "Ativo" : "Desativado"}</span>
                <div className="flex gap-2 lg:justify-end"><Button variant="outline" size="sm" onClick={() => { setEditingManager(row); setEditName(row.nome); setEditEmail(row.email); setEditFilial((row.filial as "cristo-rei" | "champagnat") || "champagnat"); }}><Pencil className="h-3.5 w-3.5" /> Editar</Button>{row.ativo ? <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void deactivate(row.id,row.nome)}>Desativar</Button> : null}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Criar acesso</DialogTitle><DialogDescription>Escolha o tipo de acesso e configure o escopo antes de enviar.</DialogDescription></DialogHeader>{lastCredential ? <div className="rounded-lg border border-success/25 bg-success-soft p-4"><p className="font-bold text-success">Acesso criado</p><p className="mt-2 text-sm">{lastCredential.email}</p><p className="mt-1 font-mono text-lg font-bold">{lastCredential.password}</p><p className="mt-2 text-xs text-muted-foreground">E-mail automático: {lastCredential.emailSent ? "enviado" : "não confirmado — use a credencial acima"}.</p></div> : <div className="grid gap-4"><div className="grid grid-cols-2 gap-2">{(["rh","gestor"] as const).map((kind) => <button key={kind} onClick={() => setCreateKind(kind)} className={`rounded-lg border p-3 text-left ${createKind===kind?"border-kt bg-kt-soft":"border-border"}`}><p className="text-sm font-bold">{kind==="rh"?"Administrativo RH":"Gestor de unidade"}</p><p className="mt-1 text-xs text-muted-foreground">{kind==="rh"?"Visão consolidada com permissões configuráveis.":"Acesso operacional restrito à unidade."}</p></button>)}</div><div className="grid gap-2 sm:grid-cols-2"><div><Label>Nome</Label><Input value={nome} onChange={(e)=>setNome(e.target.value)} /></div><div><Label>E-mail</Label><Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} /></div></div>{createKind==="gestor" ? <div><Label>Unidade</Label><div className="mt-2 flex gap-2">{(["cristo-rei","champagnat"] as const).map((id)=><button key={id} onClick={()=>setFilial(id)} className={`rounded-md border px-3 py-2 text-sm ${filial===id?"border-kt bg-kt-soft text-kt":"border-border"}`}>{filialNome(id)}</button>)}</div></div> : <><div><Label>Nível</Label><div className="mt-2 grid grid-cols-2 gap-2">{(["geral","parcial"] as const).map((value)=><button key={value} onClick={()=>setNivel(value)} className={`rounded-lg border p-3 text-left ${nivel===value?"border-kt bg-kt-soft":"border-border"}`}><p className="text-sm font-bold">{value==="geral"?"Administrador geral":"Administrador parcial"}</p><p className="mt-1 text-xs text-muted-foreground">{value==="geral"?"Acesso completo, inclusive gestão de acessos.":"Você escolhe sessão por sessão."}</p></button>)}</div></div>{nivel==="parcial" ? <PermissionMatrix value={permissions} onChange={setPermissions} /> : null}</>}<Button disabled={!nome.trim()||!email.includes("@")||saving} onClick={()=>void createAccess()}>{saving?"Criando...":"Criar e enviar acesso"}</Button></div>}</DialogContent></Dialog>

      <Dialog open={Boolean(editingAdmin)} onOpenChange={(open)=>!open&&setEditingAdmin(null)}><DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">{editingAdmin ? <><DialogHeader><DialogTitle>Permissões de {editingAdmin.nome}</DialogTitle><DialogDescription>Administrador geral enxerga tudo. No parcial, configure a matriz abaixo.</DialogDescription></DialogHeader><div className="grid grid-cols-2 gap-2">{(["geral","parcial"] as const).map((value)=><button key={value} onClick={()=>setEditingAdmin({...editingAdmin,admin_nivel:value})} className={`rounded-lg border p-3 text-left ${editingAdmin.admin_nivel===value?"border-kt bg-kt-soft":"border-border"}`}><p className="text-sm font-bold">{value==="geral"?"Administrador geral":"Administrador parcial"}</p></button>)}</div>{editingAdmin.admin_nivel==="parcial" ? <PermissionMatrix value={editingPermissions} onChange={setEditingPermissions}/> : null}<Button disabled={saving} onClick={()=>void saveAdminPermissions()}>{saving?"Salvando...":"Salvar permissões"}</Button></> : null}</DialogContent></Dialog>

      <Dialog open={Boolean(editingManager)} onOpenChange={(open)=>!open&&setEditingManager(null)}><DialogContent className="sm:max-w-md">{editingManager ? <><DialogHeader><DialogTitle>Editar gestor</DialogTitle><DialogDescription>Alterações importantes no acesso ficam sob controle do Administrador geral.</DialogDescription></DialogHeader><div className="grid gap-3"><div><Label>Nome</Label><Input value={editName} onChange={(e)=>setEditName(e.target.value)}/></div><div><Label>E-mail</Label><Input type="email" value={editEmail} onChange={(e)=>setEditEmail(e.target.value)}/></div><div><Label>Unidade</Label><div className="mt-2 flex gap-2">{(["cristo-rei","champagnat"] as const).map((id)=><button key={id} onClick={()=>setEditFilial(id)} className={`rounded-md border px-3 py-2 text-sm ${editFilial===id?"border-kt bg-kt-soft text-kt":"border-border"}`}>{filialNome(id)}</button>)}</div></div><Button disabled={saving} onClick={()=>void saveManager()}>{saving?"Salvando...":"Salvar alterações"}</Button></div></> : null}</DialogContent></Dialog>
    </section>
  );
}
