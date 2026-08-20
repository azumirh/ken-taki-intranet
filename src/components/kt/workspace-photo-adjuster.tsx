import { ImageIcon, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { filialNome } from "@/lib/kt-data";
import { supabase } from "@/lib/supabase";

type Mode = "manager" | "hr";
type PhotoRow = {
  id: string;
  nome: string;
  cargo: string;
  filial: string;
  foto: string;
  foto_pos_x: number;
  foto_pos_y: number;
  foto_zoom: number;
};

type Frame = { x: number; y: number; zoom: number };

function rowFrame(item: PhotoRow): Frame {
  return {
    x: Number(item.foto_pos_x ?? 50),
    y: Number(item.foto_pos_y ?? 35),
    zoom: Number(item.foto_zoom ?? 1),
  };
}

export function WorkspacePhotoAdjuster({ mode }: { mode: Mode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<PhotoRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [frame, setFrame] = useState<Frame>({ x: 50, y: 35, zoom: 1 });

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void supabase
      .rpc("kt_list_manageable_photo_frames")
      .then(({ data, error }) => {
        if (error) throw error;
        const next = (data ?? []) as PhotoRow[];
        setItems(next);
        const first = next[0];
        if (first) {
          setSelectedId(first.id);
          setFrame(rowFrame(first));
        }
      })
      .catch((error) => toast.error((error as Error).message || "Não foi possível carregar as fotos."))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (selected) setFrame(rowFrame(selected));
  }, [selectedId]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("kt_update_managed_photo_frame", {
        p_colaborador_id: selected.id,
        p_x: Math.round(frame.x),
        p_y: Math.round(frame.y),
        p_zoom: Number(frame.zoom.toFixed(2)),
      });
      if (error) throw error;
      setItems((previous) =>
        previous.map((item) =>
          item.id === selected.id
            ? { ...item, foto_pos_x: Math.round(frame.x), foto_pos_y: Math.round(frame.y), foto_zoom: Number(frame.zoom.toFixed(2)) }
            : item,
        ),
      );
      toast.success("Enquadramento salvo.");
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível salvar o enquadramento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
            <ImageIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-foreground">Enquadramento das fotos</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {mode === "hr"
                ? "Ajuste posição e zoom das fotos das equipes sem alterar o arquivo original."
                : "Ajuste posição e zoom das fotos da sua unidade sem alterar o arquivo original."}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => setOpen(true)}>
          <SlidersHorizontal className="h-3.5 w-3.5" /> Ajustar fotos
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajustar enquadramento</DialogTitle>
            <DialogDescription>
              Escolha uma pessoa e ajuste o foco da foto. O mesmo recorte será usado nos pontos do portal que respeitam o enquadramento salvo.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando fotos...</p>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma pessoa com foto cadastrada está disponível para ajuste.
            </div>
          ) : selected ? (
            <div className="grid gap-5 sm:grid-cols-[220px_minmax(0,1fr)]">
              <div className="grid content-start gap-3">
                <label className="grid gap-1.5 text-xs font-semibold text-foreground">
                  Pessoa
                  <select
                    value={selectedId}
                    onChange={(event) => setSelectedId(event.target.value)}
                    className="h-10 rounded-md border border-border bg-card px-3 text-sm"
                  >
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome} · {filialNome(item.filial)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mx-auto grid h-44 w-44 place-items-center overflow-hidden rounded-full bg-muted ring-2 ring-kt/15">
                  <img
                    src={selected.foto}
                    alt={selected.nome}
                    className="h-full w-full object-cover transition-transform duration-150"
                    style={{
                      objectPosition: `${frame.x}% ${frame.y}%`,
                      transform: `scale(${frame.zoom})`,
                      transformOrigin: `${frame.x}% ${frame.y}%`,
                    }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-foreground">{selected.nome}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{selected.cargo} · {filialNome(selected.filial)}</p>
                </div>
              </div>

              <div className="grid content-start gap-4 rounded-lg border border-border bg-muted/25 p-4">
                <label className="grid gap-2 text-xs font-semibold text-foreground">
                  Horizontal
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={frame.x}
                    onChange={(event) => setFrame((value) => ({ ...value, x: Number(event.target.value) }))}
                    className="w-full accent-[var(--kt)]"
                  />
                </label>
                <label className="grid gap-2 text-xs font-semibold text-foreground">
                  Vertical
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={frame.y}
                    onChange={(event) => setFrame((value) => ({ ...value, y: Number(event.target.value) }))}
                    className="w-full accent-[var(--kt)]"
                  />
                </label>
                <label className="grid gap-2 text-xs font-semibold text-foreground">
                  Zoom
                  <input
                    type="range"
                    min="1"
                    max="1.8"
                    step="0.02"
                    value={frame.zoom}
                    onChange={(event) => setFrame((value) => ({ ...value, zoom: Number(event.target.value) }))}
                    className="w-full accent-[var(--kt)]"
                  />
                </label>

                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setFrame({ x: 50, y: 35, zoom: 1 })}>
                    Centralizar
                  </Button>
                  <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
                    {saving ? "Salvando..." : "Salvar enquadramento"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
