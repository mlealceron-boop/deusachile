import { useState } from "react";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { BulkUploadResult } from "@/lib/bulk-upload";

interface Props {
  triggerLabel?: string;
  title: string;
  description: string;
  onDownloadTemplate: () => void;
  onImport: (file: File) => Promise<BulkUploadResult>;
  onDone?: () => void;
}

export function BulkUploadDialog({
  triggerLabel = "Carga masiva",
  title,
  description,
  onDownloadTemplate,
  onImport,
  onDone,
}: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkUploadResult | null>(null);

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await onImport(file);
      setResult(res);
      if (res.inserted > 0) {
        toast.success(`${res.inserted} registro${res.inserted === 1 ? "" : "s"} importado${res.inserted === 1 ? "" : "s"}`);
        onDone?.();
      }
      if (res.errors.length > 0) {
        toast.error(`${res.errors.length} fila${res.errors.length === 1 ? "" : "s"} con error`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/5">
          <Upload className="mr-2 h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-dashed border-border bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="mt-0.5 h-5 w-5 text-primary" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium">1. Descarga la plantilla</p>
                <p className="text-xs text-muted-foreground">
                  Usa este archivo Excel como base. Contiene los encabezados correctos y una hoja de instrucciones.
                </p>
                <Button size="sm" variant="secondary" onClick={onDownloadTemplate}>
                  <Download className="mr-2 h-4 w-4" /> Descargar plantilla (.xlsx)
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-dashed border-border bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <Upload className="mt-0.5 h-5 w-5 text-primary" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium">2. Sube tu archivo completado</p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setResult(null);
                  }}
                  className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
                />
                {file && (
                  <p className="truncate text-xs text-muted-foreground">Seleccionado: {file.name}</p>
                )}
              </div>
            </div>
          </div>

          {result && (
            <div className="space-y-2 rounded-md border border-border bg-white p-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="font-medium text-emerald-700">
                  {result.inserted} importado{result.inserted === 1 ? "" : "s"}
                </span>
              </div>
              {result.errors.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="font-medium text-destructive">
                      {result.errors.length} error{result.errors.length === 1 ? "" : "es"}
                    </span>
                  </div>
                  <ul className="max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-700">
                    {result.errors.map((e, i) => (
                      <li key={i} className="border-b border-slate-200 py-1 last:border-0">
                        {e.row > 0 ? `Fila ${e.row}: ` : ""}
                        {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
          <Button onClick={handleImport} disabled={!file || loading}>
            {loading ? "Importando…" : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
