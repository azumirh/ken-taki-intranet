import { Link, useRouterState } from "@tanstack/react-router";
import {
  ChevronLeft,
  ClipboardCheck,
  FileText,
  LogOut,
  Mail,
  Megaphone,
  MessageCircle,
  MessagesSquare,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAdminPermissions, type AdminSection } from "@/lib/admin-permissions";
import { AZUMI_CONTACT } from "@/lib/kt-data";
import { useSession } from "@/lib/kt-store";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { AdminVisibilityController } from "@/components/kt/admin-visibility-controller";
import { EmployeeContentInstrumentation } from "@/components/kt/employee-content-instrumentation";
import { EmployeeProfileHeader } from "@/components/kt/employee-profile-header";
import { NotificationCenter } from "@/components/kt/notification-center";
import { WorkspaceAccessCenter } from "@/components/kt/workspace-access-center";
import { WorkspaceCaseCenter } from "@/components/kt/workspace-case-center";
import { WorkspaceClimateReport } from "@/components/kt/workspace-climate-report";
import { WorkspaceContentAnalytics } from "@/components/kt/workspace-content-analytics";
import { WorkspaceOverview } from "@/components/kt/workspace-overview";
import { WorkspacePeopleAdmin } from "@/components/kt/workspace-people-admin";
import { WorkspacePersonalization } from "@/components/kt/workspace-personalization";
import { WorkspacePhotoAdjuster } from "@/components/kt/workspace-photo-adjuster";
import { WorkspaceSuggestions } from "@/components/kt/workspace-suggestions";

type WorkspaceGroup = "Principal" | "Atenção" | "Rotina" | "Pessoas" | "Conteúdo" | "Administração";
type WorkspaceItem = { id: string; label: string; group: WorkspaceGroup };
type EmployeeItem = { id: string; label: string; icon: ReactNode };
type AdminCan = ReturnType<typeof useAdminPermissions>["can"];

const MANAGER_NAV: WorkspaceItem[] = [
  { id: "workspace-top", label: "Visão geral", group: "Principal" },
  { id: "feedbacks", label: "Feedbacks", group: "Atenção" },
  { id: "apoio", label: "Pedidos de conversa", group: "Atenção" },
  { id: "clima", label: "Clima da equipe", group: "Rotina" },
  { id: "politicas", label: "Documentos", group: "Rotina" },
  { id: "equipe", label: "Equipe", group: "Pessoas" },
  { id: "sugestoes", label: "Sugestões", group: "Pessoas" },
  { id: "pesquisa-clima", label: "Pesquisa", group: "Conteúdo" },
];

const HR_NAV: WorkspaceItem[] = [
  { id: "workspace-top", label: "Visão geral", group: "Principal" },
  { id: "feedbacks", label: "Feedbacks e triagem", group: "Atenção" },
  { id: "apoio", label: "Pedidos de apoio", group: "Atenção" },
  { id: "sugestoes", label: "Sugestões", group: "Atenção" },
  { id: "clima", label: "Clima", group: "Pessoas" },
  { id: "colaboradores", label: "Colaboradores", group: "Pessoas" },
  { id: "politicas", label: "Documentos", group: "Conteúdo" },
  { id: "publicar", label: "Comunicação", group: "Conteúdo" },
  { id: "pesquisa-clima", label: "Pesquisas", group: "Conteúdo" },
  { id: "engajamento", label: "Engajamento", group: "Conteúdo" },
  { id: "acessos", label: "Acessos e permissões", group: "Administração" },
];

const EMPLOYEE_NAV: EmployeeItem[] = [
  { id: "checkin", label: "Hoje", icon: <ClipboardCheck className="h-4 w-4" /> },
  { id: "politicas", label: "Docs", icon: <FileText className="h-4 w-4" /> },
  { id: "mural", label: "Mural", icon: <Megaphone className="h-4 w-4" /> },
  { id: "feedback", label: "Falar", icon: <MessagesSquare className="h-4 w-4" /> },
];

function adminSectionsForNav(id: string): AdminSection[] {
  if (id === "workspace-top") return ["dashboard"];
  if (id === "feedbacks") return ["feedbacks"];
  if (id === "apoio") return ["apoio"];
  if (id === "sugestoes") return ["sugestoes"];
  if (id === "clima") return ["clima"];
  if (id === "colaboradores") return ["colaboradores"];
  if (id === "politicas") return ["documentos"];
  if (id === "publicar") return ["noticias", "mural"];
  if (id === "pesquisa-clima") return ["pesquisas"];
  if (id === "engajamento") return ["noticias", "mural", "pesquisas"];
  if (id === "acessos") return ["acessos"];
  return [];
}

function canSeeHrNavItem(item: WorkspaceItem, can: AdminCan) {
  const sections = adminSectionsForNav(item.id);
  return sections.length === 0 || sections.some((section) => can(section, "view"));
}

export function Brand({ size = "sm" }: { size?: "sm" | "lg" }) {
  const big = size === "lg";
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span className={`truncate font-bold tracking-tight text-foreground ${big ? "text-2xl" : "text-base sm:text-lg"}`}>
        Ken Taki
      </span>
      <span className={`shrink-0 font-medium uppercase tracking-[0.16em] text-muted-foreground ${big ? "text-xs" : "text-[10px] sm:text-[11px]"}`}>
        {BRAND.product}
      </span>
    </span>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
      {children}
    </a>
  );
}

function goToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function WorkspaceNav({ items, label }: { items: WorkspaceItem[]; label: string }) {
  const groups = Array.from(new Set(items.map((item) => item.group)));
  const [activeId, setActiveId] = useState("workspace-top");

  useEffect(() => {
    const visibleItems = items
      .map((item) => ({ item, element: document.getElementById(item.id) }))
      .filter((entry): entry is { item: WorkspaceItem; element: HTMLElement } => Boolean(entry.element));
    if (visibleItems.length === 0) return;

    const update = () => {
      const offset = 128;
      let current = visibleItems[0]!.item.id;
      for (const entry of visibleItems) {
        if (entry.element.getBoundingClientRect().top <= offset) current = entry.item.id;
      }
      setActiveId(current);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items]);

  const select = (id: string) => {
    setActiveId(id);
    goToSection(id);
  };

  return (
    <>
      <div className="sticky top-16 z-30 -mx-4 mb-4 border-b border-border bg-background/96 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => {
            const active = activeId === item.id;
            return (
              <button key={item.id} type="button" onClick={() => select(item.id)} aria-current={active ? "location" : undefined} className={`shrink-0 rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${active ? "border-kt bg-kt text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-kt/30 hover:bg-kt-soft/40 hover:text-foreground"}`}>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-24 overflow-hidden rounded-lg border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm">
          <div className="border-b border-sidebar-border px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-sidebar-foreground/55">Ken Taki · Intranet</p>
            <p className="mt-1 text-sm font-bold text-sidebar-foreground">{label}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-sidebar-foreground/55">Navegue por contexto sem perder a visão das pendências.</p>
          </div>
          <nav className="grid gap-1 p-2.5">
            {groups.map((group) => (
              <div key={group} className="grid gap-1">
                {group !== "Principal" ? <p className="px-3 pb-1 pt-3 text-[9px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/40">{group}</p> : null}
                {items.filter((item) => item.group === group).map((item) => {
                  const active = activeId === item.id;
                  return (
                    <button key={item.id} type="button" onClick={() => select(item.id)} aria-current={active ? "location" : undefined} className={`relative rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors ${active ? "bg-sidebar-accent text-sidebar-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary-foreground" : "text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}>
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}

function EmployeeNav() {
  return (
    <>
      <nav aria-label="Atalhos do colaborador" className="mx-auto mb-5 hidden w-fit items-center gap-1 rounded-lg border border-border bg-card p-1 sm:flex">
        {EMPLOYEE_NAV.map((item) => (
          <button key={item.id} type="button" onClick={() => goToSection(item.id)} className="inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            {item.icon}{item.label === "Docs" ? "Documentos" : item.label}
          </button>
        ))}
      </nav>

      <nav aria-label="Navegação do colaborador" className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/97 px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_24px_-22px_rgba(38,35,33,0.5)] backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {EMPLOYEE_NAV.map((item) => (
            <button key={item.id} type="button" onClick={() => goToSection(item.id)} className="flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-md px-1 text-[10px] font-semibold text-muted-foreground transition-colors active:bg-kt-soft active:text-kt">
              {item.icon}{item.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

export function AppShell({ children, back, onExit, onLogout }: { children: ReactNode; back?: ReactNode; onExit?: boolean; onLogout?: () => void }) {
  const [session, setSession] = useSession();
  const admin = useAdminPermissions();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const handleSair = onLogout ?? (() => setSession(null));
  const podeSair = (session || onLogout) && onExit !== false;
  const employeeWorkspace = pathname === "/painel" && session?.tipo === "colaborador";
  const hrItems = admin.loading ? [] : HR_NAV.filter((item) => canSeeHrNavItem(item, admin.can));
  const workspace = onLogout
    ? pathname === "/gestor"
      ? { items: MANAGER_NAV, label: "Gestão da unidade", mode: "manager" as const }
      : pathname === "/azumi"
        ? { items: hrItems, label: "RH · visão consolidada", mode: "hr" as const }
        : null
    : null;
  const contentVisible = admin.can("noticias", "view") || admin.can("mural", "view") || admin.can("pesquisas", "view");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/90 bg-card/95 shadow-[0_1px_0_rgba(0,0,0,0.02)] backdrop-blur-md">
        <div className="app-container flex min-h-16 items-center justify-between gap-3 py-2">
          <Link to="/" className="min-w-0 py-2" aria-label="Ir para o início"><Brand /></Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {onLogout || employeeWorkspace ? <NotificationCenter /> : null}
            {podeSair ? <Button variant="ghost" size="sm" className="h-9 rounded-md px-2.5 text-muted-foreground hover:bg-muted hover:text-foreground sm:px-3" onClick={handleSair}><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sair</span></Button> : null}
          </div>
        </div>
        {back ? <div className="app-container pb-2">{back}</div> : null}
      </header>

      <main className={`app-container flex-1 py-5 sm:py-7 lg:py-8 ${employeeWorkspace ? "pb-24 sm:pb-7 lg:pb-8" : ""}`}>
        {workspace ? (
          <div className="mx-auto w-full max-w-[1400px] lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[232px_minmax(0,1fr)] xl:gap-8">
            <WorkspaceNav items={workspace.items} label={workspace.label} />
            <div id="workspace-top" data-workspace-mode={workspace.mode} className="min-w-0 scroll-mt-24">
              {workspace.mode === "hr" ? <AdminVisibilityController /> : null}
              {workspace.mode === "manager" || admin.can("dashboard", "view") ? <div id="dashboard"><WorkspaceOverview mode={workspace.mode} /></div> : null}
              <WorkspacePersonalization />
              {workspace.mode === "manager" || admin.can("feedbacks", "view") || admin.can("apoio", "view") ? <WorkspaceCaseCenter mode={workspace.mode} /> : null}
              {workspace.mode === "manager" || admin.can("clima", "view") ? <WorkspaceClimateReport mode={workspace.mode} /> : null}
              {workspace.mode === "hr" && admin.can("sugestoes", "view") ? <WorkspaceSuggestions /> : null}
              {workspace.mode === "hr" && admin.can("colaboradores", "view") ? <WorkspacePeopleAdmin /> : null}
              {workspace.mode === "hr" && contentVisible ? <WorkspaceContentAnalytics /> : null}
              {workspace.mode === "manager" || admin.can("colaboradores", "edit") ? <WorkspacePhotoAdjuster mode={workspace.mode} /> : null}
              <div className={`legacy-workspace-content min-w-0 ${workspace.mode === "hr" ? "hr-workspace-content" : "manager-workspace-content"} ${workspace.mode === "hr" && admin.loading ? "invisible" : ""} [&>div.grid]:gap-4 [&>div.grid>div.grid]:min-w-0 [&>div.grid>div.grid]:items-start [&>div.grid>div.grid]:gap-4 [&_.surface]:min-w-0 [&_.surface]:max-w-full`} aria-busy={workspace.mode === "hr" && admin.loading}>
                {children}
              </div>
              {workspace.mode === "hr" && admin.can("acessos", "view") ? <WorkspaceAccessCenter /> : null}
            </div>
          </div>
        ) : employeeWorkspace ? (
          <div id="employee-top" data-employee-workspace className="min-w-0 scroll-mt-24"><EmployeeProfileHeader /><EmployeeNav />{children}<EmployeeContentInstrumentation /></div>
        ) : children}
      </main>

      <footer className={`mt-8 border-t border-border bg-card/70 ${employeeWorkspace ? "hidden sm:block" : ""}`}>
        <div className="app-container flex flex-col gap-4 py-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-2"><Brand /><p className="max-w-xl text-xs leading-relaxed text-muted-foreground">Canal interno de pessoas, comunicação e documentos do Ken Taki.</p></div>
          <div className="flex flex-col gap-2 sm:items-end"><div className="flex flex-wrap gap-x-4 gap-y-2"><FooterLink href={`https://wa.me/${AZUMI_CONTACT.whatsapp}`}><MessageCircle className="h-3.5 w-3.5" /> Suporte de RH</FooterLink><FooterLink href={`mailto:${AZUMI_CONTACT.email}`}><Mail className="h-3.5 w-3.5" /> E-mail</FooterLink></div><p className="text-[11px] text-muted-foreground sm:text-right">{BRAND.footerCredit}</p></div>
        </div>
      </footer>
    </div>
  );
}

export function BackLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><ChevronLeft className="h-3.5 w-3.5" />{children}</button>;
}
