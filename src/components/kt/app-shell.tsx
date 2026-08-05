import { Link } from "@tanstack/react-router";
import { LogOut, Mail, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { AZUMI_CONTACT } from "@/lib/kt-data";
import { useSession } from "@/lib/kt-store";
import { Button } from "@/components/ui/button";

export function Brand({ size = "sm" }: { size?: "sm" | "lg" }) {
  const big = size === "lg";
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`font-extrabold tracking-tight text-kt ${big ? "text-2xl" : "text-lg"}`}
        style={{ letterSpacing: "-0.04em" }}
      >
        ken<span className="text-muted-foreground font-light">·</span>taki
      </span>
      <span className={`text-muted-foreground font-light ${big ? "text-base" : "text-xs"}`}>×</span>
      <span className={`font-extrabold tracking-tight text-az ${big ? "text-2xl" : "text-lg"}`}>
        azumi
        <span className={`align-super font-bold ${big ? "text-xs" : "text-[9px]"}`}> RH</span>
      </span>
    </span>
  );
}

export function AppShell({
  children,
  back,
  onExit,
}: {
  children: ReactNode;
  back?: ReactNode;
  onExit?: boolean;
}) {
  const [session, setSession] = useSession();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur-md">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center">
            <Brand />
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={`https://wa.me/${AZUMI_CONTACT.whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:flex"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp Azumi
            </a>
            <a
              href={`mailto:${AZUMI_CONTACT.email}`}
              className="hidden items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground md:flex"
            >
              <Mail className="h-3.5 w-3.5" /> {AZUMI_CONTACT.email}
            </a>
            {session && onExit !== false ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setSession(null)}
              >
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            ) : null}
          </div>
        </div>
        {back ? (
          <div className="mx-auto w-full max-w-6xl px-4 pb-2 sm:px-6">{back}</div>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">{children}</main>

      <footer className="border-t border-border bg-card/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-6 text-xs text-muted-foreground sm:px-6">
          <Brand />
          <p className="mt-2">
            Intranet interna do Ken Taki, operada com a Azumi RH · {AZUMI_CONTACT.whatsappLabel} ·{" "}
            {AZUMI_CONTACT.email}
          </p>
        </div>
      </footer>
    </div>
  );
}

export function BackLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      ← {children}
    </button>
  );
}
