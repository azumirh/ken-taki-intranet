import { Link } from "@tanstack/react-router";
import { ChevronLeft, LogOut, Mail, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { AZUMI_CONTACT } from "@/lib/kt-data";
import { useSession } from "@/lib/kt-store";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "@/components/kt/notification-center";

export function Brand({ size = "sm" }: { size?: "sm" | "lg" }) {
  const big = size === "lg";
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span
        className={`truncate font-bold tracking-tight text-foreground ${big ? "text-2xl" : "text-base sm:text-lg"}`}
      >
        Ken Taki
      </span>
      <span className={`shrink-0 font-medium uppercase tracking-[0.16em] text-muted-foreground ${big ? "text-xs" : "text-[10px] sm:text-[11px]"}`}>
        {BRAND.product}
      </span>
    </span>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
    </a>
  );
}

export function AppShell({
  children,
  back,
  onExit,
  onLogout,
}: {
  children: ReactNode;
  back?: ReactNode;
  onExit?: boolean;
  onLogout?: () => void;
}) {
  const [session, setSession] = useSession();
  const handleSair = onLogout ?? (() => setSession(null));
  const podeSair = (session || onLogout) && onExit !== false;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/90 bg-card/95 shadow-[0_1px_0_rgba(0,0,0,0.02)] backdrop-blur-md">
        <div className="app-container flex min-h-16 items-center justify-between gap-3 py-2">
          <Link to="/" className="min-w-0 py-2" aria-label="Ir para o início">
            <Brand />
          </Link>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {onLogout ? <NotificationCenter /> : null}
            {podeSair ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-md px-2.5 text-muted-foreground hover:bg-muted hover:text-foreground sm:px-3"
                onClick={handleSair}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            ) : null}
          </div>
        </div>

        {back ? (
          <div className="app-container pb-2">{back}</div>
        ) : null}
      </header>

      <main className="app-container flex-1 py-5 sm:py-7 lg:py-8">
        {children}
      </main>

      <footer className="mt-8 border-t border-border bg-card/70">
        <div className="app-container flex flex-col gap-4 py-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-2">
            <Brand />
            <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
              Canal interno de pessoas, comunicação e documentos do Ken Taki.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <FooterLink href={`https://wa.me/${AZUMI_CONTACT.whatsapp}`}>
                <MessageCircle className="h-3.5 w-3.5" /> Suporte de RH
              </FooterLink>
              <FooterLink href={`mailto:${AZUMI_CONTACT.email}`}>
                <Mail className="h-3.5 w-3.5" /> E-mail
              </FooterLink>
            </div>
            <p className="text-[11px] text-muted-foreground sm:text-right">{BRAND.footerCredit}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function BackLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <ChevronLeft className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}
