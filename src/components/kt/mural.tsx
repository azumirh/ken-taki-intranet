import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, ExternalLink } from "lucide-react";
import { Section, EmptyState } from "@/components/kt/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EMOJIS, MURAL_TIPO_LABEL, iniciais, type MuralTipo } from "@/lib/kt-data";
import { fmtData, uid, useMural } from "@/lib/kt-store";

const TIPO_ESTILO: Record<MuralTipo, string> = {
  recado: "bg-kt-soft text-kt",
  novidade: "bg-az-soft text-az",
  data: "bg-warn-soft text-warn",
  aniversario: "bg-success-soft text-success",
};

const POST_IT_BG: Record<MuralTipo, string> = {
  recado: "bg-kt-soft/60 border-kt/20",
  novidade: "bg-az-soft/60 border-az/20",
  data: "bg-warn-soft/60 border-warn/20",
  aniversario: "bg-success-soft/60 border-success/20",
};

const ROTACOES = ["-rotate-1", "rotate-0", "rotate-1"] as const;

function fmtEvento(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Mural({
  filial,
  autorPadrao,
  podePublicar = true,
  collapsible,
  defaultOpen,
}: {
  filial: string;
  autorPadrao: string;
  podePublicar?: boolean;
  collapsible?: boolean | undefined;
  defaultOpen?: boolean | undefined;
}) {
  const [mural, setMural] = useMural();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [para, setPara] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [eventoData, setEventoData] = useState("");
  const [eventoLink, setEventoLink] = useState("");

  const itens = mural.filter((m) => !m.filial || m.filial === "todas" || m.filial === filial);

  const limpar = () => {
    setTitulo("");
    setMensagem("");
    setPara("");
    setEventoData("");
    setEventoLink("");
  };

  return (
    <Section
      id="mural"
      titulo="Mural da equipe"
      intro="Recados, novidades da Azumi RH e datas comemorativas da sua unidade."
      contagem={`${itens.length} publicações`}
      collapsible={collapsible}
      defaultOpen={defaultOpen}
      acao={
        podePublicar ? (
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) limpar();
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-full">
                Deixar um recado
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Deixar um recado no mural</DialogTitle>
                <DialogDescription>
                  Aparece para todo mundo da sua unidade. Você pode direcionar a um colega.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Escolha um emoji</Label>
                  <div className="flex flex-wrap gap-2">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        onClick={() => setEmoji(e)}
                        className={`grid h-10 w-10 place-items-center rounded-xl border text-lg transition-colors ${
                          emoji === e ? "border-kt bg-kt-soft" : "border-border"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="mtitulo">Título</Label>
                  <Input
                    id="mtitulo"
                    value={titulo}
                    maxLength={60}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ex.: Obrigada, time do sábado!"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="mpara">Para um colega específico (opcional)</Label>
                  <Input
                    id="mpara"
                    value={para}
                    maxLength={60}
                    onChange={(e) => setPara(e.target.value)}
                    placeholder="Nome do colega"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="mmsg">Sua mensagem</Label>
                  <Textarea
                    id="mmsg"
                    rows={3}
                    maxLength={400}
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="mevento">Data e horário do evento (opcional)</Label>
                  <Input
                    id="mevento"
                    type="datetime-local"
                    value={eventoData}
                    onChange={(e) => setEventoData(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="mlink">Link do evento (opcional)</Label>
                  <Input
                    id="mlink"
                    type="url"
                    placeholder="https://..."
                    value={eventoLink}
                    onChange={(e) => setEventoLink(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full rounded-full"
                  disabled={!titulo.trim() || !mensagem.trim()}
                  onClick={() => {
                    setMural([
                      {
                        id: uid(),
                        tipo: "recado",
                        titulo: titulo.trim(),
                        mensagem: para.trim()
                          ? `Para ${para.trim()}: ${mensagem.trim()}`
                          : mensagem.trim(),
                        autor: autorPadrao,
                        data: new Date().toISOString().slice(0, 10),
                        filial: filial as never,
                        emoji,
                        eventoData: eventoData || undefined,
                        eventoLink: eventoLink.trim() || undefined,
                      },
                      ...mural,
                    ]);
                    limpar();
                    setOpen(false);
                    toast.success("Recado publicado no mural!");
                  }}
                >
                  Publicar no mural
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : null
      }
    >
      {itens.length === 0 ? (
        <EmptyState>
          O mural ainda está vazio. Seja a primeira pessoa a deixar um recado.
        </EmptyState>
      ) : (
        <div className="grid gap-5 py-1 md:grid-cols-2 xl:grid-cols-3">
          {itens.map((m, idx) => (
            <article
              key={m.id}
              className={`relative flex flex-col rounded-2xl border p-5 transition-transform hover:scale-[1.01] ${POST_IT_BG[m.tipo]} ${ROTACOES[idx % 3]}`}
            >
              {/* decorative pin */}
              <div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-foreground/40 shadow-sm" />
              {/* author — prominent */}
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-primary-foreground gradient-union">
                  {iniciais(m.autor)}
                </span>
                <span className="text-sm font-bold">{m.autor}</span>
              </div>
              <span
                className={`mb-2 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${TIPO_ESTILO[m.tipo]}`}
              >
                <span aria-hidden>{m.emoji}</span> {MURAL_TIPO_LABEL[m.tipo]}
              </span>
              <h3 className="text-sm font-bold">{m.titulo}</h3>
              <p className="mt-1 flex-1 text-sm">{m.mensagem}</p>
              {m.eventoData && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  <span>{fmtEvento(m.eventoData)}</span>
                  {m.eventoLink && (
                    <a
                      href={m.eventoLink}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-1 text-kt underline underline-offset-2"
                    >
                      ver <ExternalLink className="inline h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground">{fmtData(m.data)}</p>
            </article>
          ))}
        </div>
      )}
    </Section>
  );
}
