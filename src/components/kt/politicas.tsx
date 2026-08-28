import { useState } from "react";
import { ExternalLink, Check, ShieldCheck } from "lucide-react";
import { Section } from "@/components/kt/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import capaPadrao from "@/assets/capa-padrao-politicas.jpg";
import { uid, useAssinaturas, useDocumentos, useLeituras, type Session } from "@/lib/kt-store";

type ColabSession = Extract<Session, { tipo: "colaborador" }>;
type GestorSession = Extract<Session, { tipo: "gestor" }>;
type UsuarioSession = ColabSession | GestorSession;

function gerarProtocolo(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `KT-${ts}-${rand}`;
}

export function Documentos({
  session,
  collapsible,
  defaultOpen,
}: {
  session: UsuarioSession;
  collapsible?: boolean | undefined;
  defaultOpen?: boolean | undefined;
}) {
  const [documentos] = useDocumentos();
  const [assinaturas, setAssinaturas] = useAssinaturas();
  const [leituras, setLeituras] = useLeituras();

  // Dialog de confirmação de CPF
  const [docPendente, setDocPendente] = useState<(typeof docs)[number] | null>(null);
  const [cpfDigitado, setCpfDigitado] = useState("");
  const [cpfErro, setCpfErro] = useState("");
  const [assinando, setAssinando] = useState(false);

  const docs = documentos.filter(
    (d) =>
      (d.filial === session.filial || d.filial === "todas") &&
      (session.tipo === "gestor" || d.categoria !== "gestao"),
  );
  const leu = (id: string) => leituras.some((l) => l.documentoId === id && l.nome === session.nome);
  const assinou = (id: string) =>
    assinaturas.some((a) => a.politica === id && a.nome === session.nome);
  const totalAssinados = docs.filter((d) => assinou(d.id)).length;

  const abrirDoc = (doc: (typeof docs)[number]) => {
    window.open(doc.url, "_blank", "noreferrer");
    if (!leu(doc.id)) {
      setLeituras((prev) => [
        { id: uid(), documentoId: doc.id, nome: session.nome, filial: session.filial, ts: Date.now() },
        ...prev,
      ]);
    }
  };

  const confirmarAssinatura = () => {
    if (!docPendente) return;
    const cpf = cpfDigitado.replace(/\D/g, "");
    if (cpf.length !== 11) {
      setCpfErro("Digite o CPF completo (11 dígitos).");
      return;
    }
    setAssinando(true);
    const protocolo = gerarProtocolo();
    setAssinaturas((prev) => [
      ...prev,
      {
        id: uid(),
        politica: docPendente.id,
        nome: session.nome,
        filial: session.filial,
        ts: Date.now(),
        cpfConfirmado: cpf,
        protocolo,
      },
    ]);
    setDocPendente(null);
    setCpfDigitado("");
    setCpfErro("");
    setAssinando(false);
  };

  if (docs.length === 0) return null;

  return (
    <>
      <Section
        id="politicas"
        titulo="Documentos e políticas"
        intro="Leia cada documento e assine para confirmar que recebeu."
        contagem={`${totalAssinados} de ${docs.length} assinados`}
        collapsible={collapsible}
        defaultOpen={defaultOpen}
      >
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {docs.map((doc) => {
            const jaLeu = leu(doc.id);
            const jaAssinou = assinou(doc.id);
            const assinatura = assinaturas.find(
              (a) => a.politica === doc.id && a.nome === session.nome,
            );
            return (
              <article
                key={doc.id}
                className="flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-border bg-card"
              >
                <div className="relative">
                  <img
                    src={capaPadrao}
                    alt=""
                    width={1024}
                    height={512}
                    loading="lazy"
                    className="h-28 w-full object-cover"
                  />
                  <span
                    className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
                    style={{ backgroundColor: doc.corTag }}
                  >
                    {doc.textoTag}
                  </span>
                  {jaAssinou && (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                      <Check className="h-3 w-3" /> Assinado
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col p-4">
                  <h3 className="break-words text-sm font-bold [overflow-wrap:anywhere]">{doc.titulo}</h3>
                  <p className="mt-1 flex-1 text-xs text-muted-foreground">
                    Publicado em {new Date(doc.data + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                  {assinatura?.protocolo && (
                    <p className="mt-1 break-all text-[10px] font-mono text-muted-foreground/60">
                      Protocolo: {assinatura.protocolo}
                    </p>
                  )}
                  <div className="mt-3 grid gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-auto min-h-9 w-full whitespace-normal rounded-full py-2 text-center leading-tight"
                      onClick={() => abrirDoc(doc)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {jaLeu ? "Ler novamente" : "Abrir documento"}
                    </Button>
                    {!jaAssinou && (
                      <Button
                        size="sm"
                        className="h-auto min-h-9 w-full whitespace-normal rounded-full py-2 text-center leading-tight disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
                        disabled={!jaLeu}

                        onClick={() => {
                          setCpfDigitado("");
                          setCpfErro("");
                          setDocPendente(doc);
                        }}
                        title={!jaLeu ? "Abra o documento primeiro" : undefined}
                      >
                        {jaLeu ? "Assinar" : "Abra para assinar"}
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      {/* Diálogo de confirmação de CPF */}
      <Dialog
        open={!!docPendente}
        onOpenChange={(o) => {
          if (!o) {
            setDocPendente(null);
            setCpfDigitado("");
            setCpfErro("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-kt" />
              Confirmar assinatura
            </DialogTitle>
            <DialogDescription>
              Digite seu CPF completo para assinar <strong>{docPendente?.titulo}</strong> e gerar o
              protocolo de confirmação.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="cpf-confirm">CPF completo</Label>
              <Input
                id="cpf-confirm"
                placeholder="000.000.000-00"
                value={cpfDigitado}
                onChange={(e) => {
                  setCpfDigitado(e.target.value);
                  setCpfErro("");
                }}
                onKeyDown={(e) => e.key === "Enter" && confirmarAssinatura()}
                maxLength={14}
              />
              {cpfErro && <p className="text-sm font-medium text-destructive">{cpfErro}</p>}
            </div>
            <p className="text-xs text-muted-foreground">
              Ao confirmar, declaramos que você leu e recebeu este documento. Um número de protocolo
              único será gerado para registro.
            </p>
            <div className="grid gap-2 sm:flex">
              <Button
                className="w-full rounded-full sm:flex-1"
                disabled={assinando || !cpfDigitado.trim()}
                onClick={confirmarAssinatura}
              >
                {assinando ? "Registrando..." : "Confirmar assinatura"}
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-full sm:w-auto"
                onClick={() => {
                  setDocPendente(null);
                  setCpfDigitado("");
                  setCpfErro("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
