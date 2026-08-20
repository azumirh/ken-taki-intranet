import { History, Pencil, Search, UserCheck, UserX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminPermissions } from "@/lib/admin-permissions";
import { FILIAIS, filialNome } from "@/lib/kt-data";
import { supabase } from "@/lib/supabase";

type Person = {
  id: string;
  nome: string;
  cpf3: string;
  cargo: string;
  filial: string;
  nascimento: string;
  admissao: string;
  foto: string | null;
  ativo: boolean;
};

type Audit = {
  id: string;
  colaborador_id: string;
  actor_id: string | null;
  filial: string;
  fields_changed: string[];
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  created_at: string;
};

export function WorkspacePeopleAdmin() {
  const { can } = useAdminPermissions();
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState("");
  const [filial, setFilial] = useState("todas");
  const [status, setStatus] = useState("ativos");
  const [editing, setEditing] = useState<Person | null>(null);
  const [name, setName] = useState("");
  const [cpf3, setCpf3] = useState("");
  const [cargo, setCargo] = useState("");
  const [editFilial, setEditFilial] = useState("champagnat");
  const [nascimento, setNascimento] = useState("");
  const [admissao, setAdmissao] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [auditOpen, setAuditOpen] = useState<Person | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("kt_colaboradores")
      .select("id,nome,cpf3,cargo,filial,nascimento,admissao,foto,ativo")
      .order("nome");
    if (error) throw error;
    setPeople((data ?? []) as Person[]);
  }, []);

  useEffect(() => {
    if (can("colaboradores", "view")) void load().catch((error) => toast.error((error as Error).message));
  }, [can, load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return people.filter((person) => {
      const searchOk = !term || `${person.nome} ${person.cargo}`.toLowerCase().includes(term);
      const filialOk = filial === "todas" || person.filial === filial;
      const statusOk = status === "todos" || (status === "ativos" ? person.ativo : !person.ativo);
      return searchOk && filialOk && statusOk;
    });
  }, [filial, people, search, status]);

  if (!can("colaboradores", "view")) return null;

  function openEdit(person: Person) {
    setEditing(person);
    setName(person.nome);
    setCpf3(person.cpf3);
    setCargo(person.cargo);
    setEditFilial(person.filial);
    setNascimento(person.nascimento);
    setAdmissao(person.admissao);
    setAtivo(person.ativo);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("kt_admin_update_colaborador", {
        p_colaborador_id: editing.id,
        p_nome: name.trim(),
        p_cpf3: cpf3,
        p_cargo: cargo.trim(),
        p_filial: editFilial,
        p_nascimento: nascimento,
        p_admissao: admissao,
        p_ativo: ativo,
      });
      if (error) throw error;
      toast.success("Cadastro atualizado. Alterações importantes foram registradas e a gestão afetada será notificada.");
      setEditing(null);
      await load();
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível atualizar o colaborador.");
    } finally {
      setSaving(false);
    }
  }

  async function openAudit(person: Person) {
    setAuditOpen(person);
    const { data, error } = await supabase
      .from("kt_colaborador_auditoria")
      .select("id,colaborador_id,actor_id,filial,fields_changed,old_values,new_values,created_at")
      .eq("colaborador_id", person.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) toast.error(error.message);
    setAudits((data ?? []) as Audit[]);
  }

  return (
    <section id="colaboradores" className="surface mb-5 scroll-mt-24 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-start sm:justify-between lg:px-6">
        <div>
          <h2 className="text-lg font-bold">Colaboradores</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulte e corrija cadastros. Mudanças de nome, cargo, unidade, admissão ou status geram trilha de auditoria e aviso à gestão afetada.
          </p>
        </div>
        <div className="text-xs text-muted-foreground"><strong className="text-foreground">{filtered.length}</strong> pessoa(s) no filtro</div>
      </div>

      <div className="grid gap-4 p-5 lg:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1 sm:max-w-sm">
            <Label>Buscar</Label>
            <div className="relative mt-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Nome ou cargo..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          </div>
          <div><Label>Unidade</Label><select className="mt-1 h-9 rounded-md border border-border bg-card px-3 text-sm" value={filial} onChange={(event) => setFilial(event.target.value)}><option value="todas">Todas</option>{FILIAIS.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></div>
          <div><Label>Status</Label><select className="mt-1 h-9 rounded-md border border-border bg-card px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ativos">Ativos</option><option value="inativos">Inativos</option><option value="todos">Todos</option></select></div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          <div className="hidden grid-cols-[minmax(180px,1.2fr)_minmax(130px,.8fr)_140px_120px_120px_auto] gap-3 border-b border-border bg-muted/55 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground lg:grid">
            <span>Colaborador</span><span>Cargo</span><span>Unidade</span><span>Admissão</span><span>Status</span><span className="text-right">Ações</span>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((person) => (
              <div key={person.id} className="grid gap-3 px-4 py-3.5 lg:grid-cols-[minmax(180px,1.2fr)_minmax(130px,.8fr)_140px_120px_120px_auto] lg:items-center">
                <div className="flex items-center gap-3">
                  {person.foto ? <img src={person.foto} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold">{person.nome.split(" ").slice(0,2).map((part)=>part[0]).join("")}</span>}
                  <div><p className="text-sm font-semibold">{person.nome}</p><p className="text-[10px] text-muted-foreground">CPF final {person.cpf3}</p></div>
                </div>
                <p className="text-sm text-muted-foreground">{person.cargo}</p>
                <p className="text-sm">{filialNome(person.filial)}</p>
                <p className="text-xs text-muted-foreground">{new Date(`${person.admissao}T00:00:00`).toLocaleDateString("pt-BR")}</p>
                <span className={`inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold ${person.ativo ? "bg-success-soft text-success" : "bg-destructive/10 text-destructive"}`}>{person.ativo ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}{person.ativo ? "Ativo" : "Inativo"}</span>
                <div className="flex gap-1 lg:justify-end"><Button variant="ghost" size="sm" onClick={() => void openAudit(person)}><History className="h-3.5 w-3.5" /> Histórico</Button>{can("colaboradores", "edit") ? <Button variant="outline" size="sm" onClick={() => openEdit(person)}><Pencil className="h-3.5 w-3.5" /> Editar</Button> : null}</div>
              </div>
            ))}
            {filtered.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum colaborador neste filtro.</p> : null}
          </div>
        </div>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Editar colaborador</DialogTitle><DialogDescription>Alterações relevantes ficam registradas. Se afetarem a operação da unidade, o gestor recebe notificação.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2"><div><Label>Nome completo</Label><Input className="mt-1" value={name} onChange={(event) => setName(event.target.value)} /></div><div><Label>Últimos 3 dígitos do CPF</Label><Input className="mt-1" inputMode="numeric" maxLength={3} value={cpf3} onChange={(event) => setCpf3(event.target.value.replace(/\D/g, "").slice(0,3))} /></div></div>
            <div className="grid gap-3 sm:grid-cols-2"><div><Label>Cargo</Label><Input className="mt-1" value={cargo} onChange={(event) => setCargo(event.target.value)} /></div><div><Label>Unidade</Label><select className="mt-1 h-9 w-full rounded-md border border-border bg-card px-3 text-sm" value={editFilial} onChange={(event) => setEditFilial(event.target.value)}>{FILIAIS.map((item)=><option key={item.id} value={item.id}>{item.nome}</option>)}</select></div></div>
            <div className="grid gap-3 sm:grid-cols-2"><div><Label>Nascimento</Label><Input className="mt-1" type="date" value={nascimento} onChange={(event)=>setNascimento(event.target.value)} /></div><div><Label>Admissão</Label><Input className="mt-1" type="date" value={admissao} onChange={(event)=>setAdmissao(event.target.value)} /></div></div>
            <label className="flex items-center justify-between rounded-lg border border-border p-3"><span><span className="block text-sm font-semibold">Cadastro ativo</span><span className="block text-xs text-muted-foreground">Desativar preserva o histórico da pessoa.</span></span><input type="checkbox" className="h-5 w-5 accent-kt" checked={ativo} onChange={(event)=>setAtivo(event.target.checked)} /></label>
            <Button disabled={saving || !name.trim() || cpf3.length !== 3 || !cargo.trim() || !nascimento || !admissao} onClick={() => void save()}>{saving ? "Salvando..." : "Salvar alterações"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(auditOpen)} onOpenChange={(open) => !open && setAuditOpen(null)}>
        <DialogContent className="max-h-[84vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>Histórico de {auditOpen?.nome}</DialogTitle><DialogDescription>Alterações importantes feitas no cadastro.</DialogDescription></DialogHeader>
          <div className="grid gap-2">{audits.length === 0 ? <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Nenhuma alteração auditada ainda.</p> : audits.map((audit)=><div key={audit.id} className="rounded-lg border border-border bg-background p-3"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold">{audit.fields_changed.join(", ")}</span><span className="ml-auto text-[10px] text-muted-foreground">{new Date(audit.created_at).toLocaleString("pt-BR")}</span></div><div className="mt-2 grid gap-2 text-[11px] sm:grid-cols-2"><div className="rounded bg-muted/50 p-2"><p className="font-bold text-muted-foreground">Antes</p><pre className="mt-1 whitespace-pre-wrap font-sans">{JSON.stringify(audit.old_values, null, 2)}</pre></div><div className="rounded bg-muted/50 p-2"><p className="font-bold text-muted-foreground">Depois</p><pre className="mt-1 whitespace-pre-wrap font-sans">{JSON.stringify(audit.new_values, null, 2)}</pre></div></div></div>)}</div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
