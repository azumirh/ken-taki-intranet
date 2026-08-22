import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Cake,
  ClipboardCheck,
  FileCheck2,
  Lightbulb,
  Megaphone,
  MessageCircleHeart,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/kt/app-shell";
import heroHome from "@/assets/hero-home.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Intranet Ken Taki" },
      {
        name: "description",
        content:
          "Seu espaço interno no Ken Taki para acompanhar documentos, comunicação, clima, aniversários e canais de escuta.",
      },
      { property: "og:title", content: "Intranet Ken Taki" },
      {
        property: "og:description",
        content: "Informação, cuidado e comunicação do time Ken Taki em um só lugar.",
      },
    ],
  }),
  component: Index,
});

const RECURSOS = [
  {
    icon: ClipboardCheck,
    titulo: "Check-in do dia",
    texto: "Registre como você está e acompanhe sua experiência no trabalho.",
  },
  {
    icon: FileCheck2,
    titulo: "Documentos e políticas",
    texto: "Leia, consulte e confirme documentos importantes da empresa.",
  },
  {
    icon: Megaphone,
    titulo: "Mural e novidades",
    texto: "Acompanhe comunicados, notícias e conteúdos do Ken Taki.",
  },
  {
    icon: Cake,
    titulo: "Aniversários",
    texto: "Celebre as pessoas do time com reações e mensagens.",
  },
  {
    icon: MessageCircleHeart,
    titulo: "Fale com quem precisa",
    texto: "Use os canais de apoio, feedback e conversa com RH ou liderança.",
  },
  {
    icon: Lightbulb,
    titulo: "Sugestões",
    texto: "Compartilhe ideias e acompanhe os temas que ajudam a melhorar a rotina.",
  },
] as const;

function Index() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1260px]">
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-[#351526] px-4 py-2.5 text-white sm:px-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
            Acessos internos
          </p>
          <nav className="flex items-center gap-1" aria-label="Acessos administrativos">
            <Link
              to="/gestor"
              className="rounded-md px-3 py-2 text-xs font-semibold text-white/78 transition-colors hover:bg-white/10 hover:text-white"
            >
              Sou gestor
            </Link>
            <span className="h-4 w-px bg-white/20" aria-hidden />
            <Link
              to="/azumi"
              className="rounded-md px-3 py-2 text-xs font-semibold text-white/78 transition-colors hover:bg-white/10 hover:text-white"
            >
              Sou RH
            </Link>
          </nav>
        </div>

        <section className="relative overflow-hidden rounded-xl bg-[#4b1736] text-white shadow-[0_24px_70px_-38px_rgba(53,21,38,0.72)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(255,255,255,0.12),transparent_28%),linear-gradient(120deg,rgba(53,21,38,0.10),rgba(53,21,38,0.74))]" />
          <img
            src={heroHome}
            alt="Pessoa do time Ken Taki"
            width={1600}
            height={900}
            className="absolute inset-0 h-full w-full object-cover object-[62%_center] opacity-25 sm:opacity-32 lg:left-auto lg:right-0 lg:w-[48%] lg:opacity-88"
          />
          <div className="absolute inset-0 bg-linear-to-r from-[#4b1736] via-[#4b1736]/94 to-[#4b1736]/55 lg:to-transparent" />

          <div className="relative grid min-h-[520px] items-center gap-8 px-6 py-12 sm:px-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_46%] lg:px-14 lg:py-16">
            <div className="max-w-2xl">
              <div className="mb-8 inline-flex items-center gap-3">
                <span className="text-xl font-black tracking-[0.08em] sm:text-2xl">KEN TAKI</span>
                <span className="h-5 w-px bg-white/28" aria-hidden />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/58">
                  Intranet
                </span>
              </div>

              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e9c5d5]">
                Seu espaço no Ken Taki
              </p>
              <h1 className="mt-3 max-w-xl text-4xl font-black leading-[1.02] tracking-[-0.045em] sm:text-5xl lg:text-[3.65rem]">
                Informação, cuidado e conexão no seu dia a dia.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/72 sm:text-lg">
                Acesse documentos, comunicados, aniversários, check-in, sugestões e canais de
                conversa em um ambiente feito para o time.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  to="/colaborador"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-extrabold text-[#4b1736] shadow-lg transition-transform hover:-translate-y-0.5"
                >
                  Acessar meu portal <ArrowRight className="h-4 w-4" />
                </Link>
                <span className="inline-flex items-center justify-center gap-2 text-xs font-medium text-white/62 sm:justify-start">
                  <ShieldCheck className="h-4 w-4 text-[#e9c5d5]" />
                  Acesso simples e protegido
                </span>
              </div>
            </div>
            <div className="hidden lg:block" />
          </div>
        </section>

        <section className="py-10 sm:py-12" aria-labelledby="recursos-title">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7a3049]">
              Feito para a rotina do time
            </p>
            <h2 id="recursos-title" className="mt-2 text-2xl font-extrabold sm:text-3xl">
              O que você encontra na intranet
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              O essencial para acompanhar sua jornada no Ken Taki sem procurar informação em
              vários lugares.
            </p>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {RECURSOS.map(({ icon: Icon, titulo, texto }) => (
              <article
                key={titulo}
                className="group rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:border-[#7a3049]/30 hover:shadow-[var(--shadow-lift)]"
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#f3e6eb] text-[#6c2444] transition-colors group-hover:bg-[#6c2444] group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-bold">{titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{texto}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-4 overflow-hidden rounded-xl border border-[#6c2444]/15 bg-[#f4e9ed] px-6 py-7 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7a3049]">Para colaboradores</p>
            <h2 className="mt-2 text-2xl font-extrabold text-[#351526]">Seu portal começa por aqui.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#5f4d56]">
              Informe sua unidade, seu nome completo e os três últimos dígitos do CPF para localizar
              seu cadastro com segurança.
            </p>
          </div>
          <Link
            to="/colaborador"
            className="mt-5 inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-[#4b1736] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#351526] sm:mt-0"
          >
            Entrar <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
