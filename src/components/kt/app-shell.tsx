import { Link } from "@tanstack/react-router";
import { ChevronLeft, LogOut, Mail, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { AZUMI_CONTACT } from "@/lib/kt-data";
import { useSession } from "@/lib/kt-store";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";

export function Brand({ size = "sm" }: { size?: "sm" | "lg" }) {
  const big = size === "lg";
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`font-extrabold tracking-tight text-kt ${big ? "text-2xl" : "text-lg"}`}
        style={{ letterSpacing: "-0.04em" }}
      >
        Ken Taki
      </span>
      <span className={`text-muted-foreground font-light ${big ? "text-base" : "text-xs"}`}>·</span>
      <span className={`text-muted-foreground font-medium ${big ? "text-base" : "text-xs"}`}>
        {BRAND.product}
      </span>
    </span>
  );
}

function IconLink({
  href,
  label,
  children,
  tone = "muted",
}: {
  href: string;
  label: string;
  children: ReactNode;
  tone?: "muted" | "success";
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      title={label}
      aria-label={label}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] ${
        tone === "success"
          ? "border-success/25 bg-success-soft text-success hover:bg-success/15"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
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
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur-md">
        <div className="mx-auto grid w-full max-w-[1400px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center">
            <Brand />
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <IconLink
              href={`https://wa.me/${AZUMI_CONTACT.whatsapp}`}
              label="Contato via WhatsApp"
              tone="success"
            >
              <MessageCircle className="h-4 w-4" />
            </IconLink>
            <IconLink href={`mailto:${AZUMI_CONTACT.email}`} label="Contato por e-mail">
              <Mail className="h-4 w-4" />
            </IconLink>
            {podeSair ? (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-muted-foreground"
                onClick={handleSair}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            ) : null}
          </div>
        </div>
        {back ? (
          <div className="mx-auto w-full max-w-[1400px] px-4 pb-2 sm:px-6 lg:px-8">{back}</div>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        {children}
      </main>

      <footer className="mt-10 border-t border-border bg-card/60">
        <div className="mx-auto grid w-full max-w-[1400px] gap-4 px-4 py-8 text-xs text-muted-foreground sm:px-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-center lg:px-8">
          <Brand />
          <p className="md:text-right">{BRAND.footerCredit}</p>
        </div>
      </footer>
    </div>
  );
}

export function BackLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-all hover:bg-muted hover:text-foreground hover:shadow-none"
    >
      <ChevronLeft className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}
