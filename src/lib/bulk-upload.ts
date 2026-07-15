import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export interface BulkUploadResult {
  inserted: number;
  errors: { row: number; message: string }[];
}

// ---------------- Template download ----------------
export function downloadTemplate(opts: {
  filename: string;
  sheetName: string;
  headers: string[];
  sampleRows?: (string | number)[][];
  instructions?: string[];
}) {
  const wb = XLSX.utils.book_new();
  const dataAoa: (string | number)[][] = [opts.headers, ...(opts.sampleRows ?? [])];
  const ws = XLSX.utils.aoa_to_sheet(dataAoa);
  ws["!cols"] = opts.headers.map((h) => ({ wch: Math.max(14, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, opts.sheetName);
  if (opts.instructions?.length) {
    const insWs = XLSX.utils.aoa_to_sheet(opts.instructions.map((l) => [l]));
    insWs["!cols"] = [{ wch: 100 }];
    XLSX.utils.book_append_sheet(wb, insWs, "Instrucciones");
  }
  // Use write + Blob for reliable browser download (avoids XLSX.writeFile issues in some bundles)
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------- Excel → rows ----------------
export async function parseExcel(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const first = wb.SheetNames[0];
  const ws = wb.Sheets[first];
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
}

const norm = (v: unknown) =>
  v === null || v === undefined ? "" : String(v).trim();

// ---------------- CLIENTES ----------------
export const CLIENTES_HEADERS = [
  "nombre",
  "rut",
  "clinica",
  "telefono",
  "email",
  "direccion",
  "rss",
  "tipo",
  "estado",
  "region",
  "ciudad",
  "comuna",
  "nivel",
  "interes",
  "notas",
  "ejecutivo_email",
];

export function descargarPlantillaClientes() {
  downloadTemplate({
    filename: "plantilla_clientes.xlsx",
    sheetName: "Clientes",
    headers: CLIENTES_HEADERS,
    sampleRows: [
      [
        "Dr. Juan Pérez",
        "12.345.678-9",
        "Clínica Bella",
        "+56 9 1234 5678",
        "juan@ejemplo.com",
        "Av. Providencia 1234",
        "@clinicabella",
        "clinica_propia",
        "prospecto",
        "Metropolitana de Santiago",
        "Santiago",
        "Providencia",
        "A",
        "Láser, Toxina",
        "Cliente referido por Dra. Soto",
        "ejecutivo@empresa.cl",
      ],
    ],
    instructions: [
      "PLANTILLA CARGA MASIVA DE CLIENTES",
      "",
      "Columnas obligatorias: nombre.",
      "tipo: clinica_propia | recien_empieza  (por defecto: recien_empieza)",
      "estado: prospecto | activo | inactivo  (por defecto: prospecto)",
      "ejecutivo_email: email de un usuario existente (si se omite, se asigna al admin que carga).",
      "No modifiques los nombres de las columnas de la primera fila.",
    ],
  });
}

export async function importarClientes(
  file: File,
  currentUserId: string,
): Promise<BulkUploadResult> {
  const rows = await parseExcel(file);
  const errors: BulkUploadResult["errors"] = [];

  const { data: users } = await supabase.from("usuarios").select("id, email");
  const emailToId = new Map(
    (users ?? []).map((u) => [u.email.toLowerCase(), u.id]),
  );

  const validTipos = new Set(["clinica_propia", "recien_empieza"]);
  const validEstados = new Set(["prospecto", "activo", "inactivo"]);
  const payload: Record<string, unknown>[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const nombre = norm(r.nombre);
    if (!nombre) {
      errors.push({ row: rowNum, message: "Falta 'nombre'" });
      return;
    }
    const tipo = norm(r.tipo) || "recien_empieza";
    if (!validTipos.has(tipo)) {
      errors.push({ row: rowNum, message: `Tipo inválido: ${tipo}` });
      return;
    }
    const estado = norm(r.estado) || "prospecto";
    if (!validEstados.has(estado)) {
      errors.push({ row: rowNum, message: `Estado inválido: ${estado}` });
      return;
    }
    let ejecutivo_id = currentUserId;
    const ejecEmail = norm(r.ejecutivo_email).toLowerCase();
    if (ejecEmail) {
      const found = emailToId.get(ejecEmail);
      if (!found) {
        errors.push({ row: rowNum, message: `Ejecutivo no encontrado: ${ejecEmail}` });
        return;
      }
      ejecutivo_id = found;
    }
    const telefono = norm(r.telefono) || null;
    const email = norm(r.email) || null;
    payload.push({
      nombre,
      rut: norm(r.rut) || null,
      clinica: norm(r.clinica) || null,
      telefono,
      email,
      contacto: telefono || email || null,
      direccion: norm(r.direccion) || null,
      rss: norm(r.rss) || null,
      tipo,
      estado,
      region: norm(r.region) || null,
      ciudad: norm(r.ciudad) || null,
      comuna: norm(r.comuna) || null,
      nivel: norm(r.nivel) || null,
      interes: norm(r.interes) || null,
      notas: norm(r.notas) || null,
      ejecutivo_id,
    });
  });

  if (payload.length === 0) return { inserted: 0, errors };

  const { error, count } = await supabase
    .from("clientes")
    .insert(payload as never, { count: "exact" });
  if (error) {
    errors.push({ row: 0, message: error.message });
    return { inserted: 0, errors };
  }
  return { inserted: count ?? payload.length, errors };
}

// ---------------- VENTAS ----------------
export const VENTAS_HEADERS = [
  "venta_ref",
  "cliente_rut_o_nombre",
  "ejecutivo_email",
  "fecha",
  "porcentaje_comision",
  "producto_nombre",
  "cantidad",
  "precio_neto_unit",
];

export function descargarPlantillaVentas() {
  downloadTemplate({
    filename: "plantilla_ventas.xlsx",
    sheetName: "Ventas",
    headers: VENTAS_HEADERS,
    sampleRows: [
      ["V001", "12.345.678-9", "ejecutivo@empresa.cl", "2026-01-15", 10, "Producto A", 2, 15000],
      ["V001", "12.345.678-9", "ejecutivo@empresa.cl", "2026-01-15", 10, "Producto B", 1, 22000],
      ["V002", "Dr. Juan Pérez", "ejecutivo@empresa.cl", "2026-01-16", 8, "Producto A", 5, 15000],
    ],
    instructions: [
      "PLANTILLA CARGA MASIVA DE VENTAS",
      "",
      "Cada fila = 1 ítem de venta. Agrupa múltiples ítems en la misma venta usando el mismo 'venta_ref'.",
      "",
      "Columnas obligatorias: venta_ref, cliente_rut_o_nombre, ejecutivo_email, producto_nombre, cantidad, precio_neto_unit.",
      "cliente_rut_o_nombre: RUT exacto del cliente, o su nombre completo (case-insensitive).",
      "ejecutivo_email: email de un usuario existente.",
      "fecha: formato YYYY-MM-DD. Si se omite, se usa la fecha actual.",
      "porcentaje_comision: numérico (ej: 10 = 10%). Se toma el de la primera fila de cada venta_ref. Si se omite, usa la configuración global.",
      "producto_nombre: nombre exacto del producto (case-insensitive).",
      "Los totales (neto/bruto/comisión) se calculan automáticamente al importar.",
    ],
  });
}

export async function importarVentas(
  file: File,
  currentUserId: string,
): Promise<BulkUploadResult> {
  const rows = await parseExcel(file);
  const errors: BulkUploadResult["errors"] = [];

  const [{ data: clientes }, { data: users }, { data: productos }, { data: cfg }] =
    await Promise.all([
      supabase.from("clientes").select("id, nombre, rut"),
      supabase.from("usuarios").select("id, email"),
      supabase.from("productos").select("id, nombre"),
      supabase.from("config_comision").select("porcentaje").limit(1).maybeSingle(),
    ]);

  const clienteByRut = new Map<string, string>();
  const clienteByNombre = new Map<string, string>();
  (clientes ?? []).forEach((c) => {
    if (c.rut) clienteByRut.set(c.rut.trim().toLowerCase(), c.id);
    clienteByNombre.set(c.nombre.trim().toLowerCase(), c.id);
  });
  const userByEmail = new Map((users ?? []).map((u) => [u.email.toLowerCase(), u.id]));
  const productoByNombre = new Map(
    (productos ?? []).map((p) => [p.nombre.trim().toLowerCase(), p.id]),
  );
  const defaultPct = Number((cfg as { porcentaje?: number } | null)?.porcentaje ?? 10);

  // Group rows by venta_ref
  interface Group {
    firstRow: number;
    cliente_id: string;
    ejecutivo_id: string;
    fecha: string;
    porcentaje_comision: number;
    items: { producto_id: string; cantidad: number; precio_neto_unit: number }[];
  }
  const groups = new Map<string, Group>();

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const ref = norm(r.venta_ref);
    if (!ref) {
      errors.push({ row: rowNum, message: "Falta 'venta_ref'" });
      return;
    }
    const clienteKey = norm(r.cliente_rut_o_nombre).toLowerCase();
    if (!clienteKey) {
      errors.push({ row: rowNum, message: "Falta 'cliente_rut_o_nombre'" });
      return;
    }
    const cliente_id = clienteByRut.get(clienteKey) ?? clienteByNombre.get(clienteKey);
    if (!cliente_id) {
      errors.push({ row: rowNum, message: `Cliente no encontrado: ${r.cliente_rut_o_nombre}` });
      return;
    }
    const ejecEmail = norm(r.ejecutivo_email).toLowerCase();
    const ejecutivo_id = userByEmail.get(ejecEmail);
    if (!ejecutivo_id) {
      errors.push({ row: rowNum, message: `Ejecutivo no encontrado: ${r.ejecutivo_email}` });
      return;
    }
    const prodKey = norm(r.producto_nombre).toLowerCase();
    const producto_id = productoByNombre.get(prodKey);
    if (!producto_id) {
      errors.push({ row: rowNum, message: `Producto no encontrado: ${r.producto_nombre}` });
      return;
    }
    const cantidad = Number(r.cantidad);
    const precio = Number(r.precio_neto_unit);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      errors.push({ row: rowNum, message: "Cantidad inválida" });
      return;
    }
    if (!Number.isFinite(precio) || precio < 0) {
      errors.push({ row: rowNum, message: "precio_neto_unit inválido" });
      return;
    }

    let fecha = norm(r.fecha);
    if (r.fecha instanceof Date) fecha = r.fecha.toISOString();
    else if (fecha) {
      const d = new Date(fecha);
      fecha = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    } else {
      fecha = new Date().toISOString();
    }

    let g = groups.get(ref);
    if (!g) {
      const pct = r.porcentaje_comision != null && r.porcentaje_comision !== ""
        ? Number(r.porcentaje_comision)
        : defaultPct;
      g = {
        firstRow: rowNum,
        cliente_id,
        ejecutivo_id,
        fecha,
        porcentaje_comision: Number.isFinite(pct) ? pct : defaultPct,
        items: [],
      };
      groups.set(ref, g);
    }
    g.items.push({ producto_id, cantidad, precio_neto_unit: precio });
  });

  let inserted = 0;
  for (const [ref, g] of groups) {
    if (g.items.length === 0) continue;
    const { data: venta, error: vErr } = await supabase
      .from("ventas")
      .insert({
        cliente_id: g.cliente_id,
        ejecutivo_id: g.ejecutivo_id,
        fecha: g.fecha,
        porcentaje_comision: g.porcentaje_comision,
        total_neto: 0,
        total_bruto: 0,
        total_comision: 0,
        creado_por: currentUserId,
      })
      .select("id")
      .single();
    if (vErr || !venta) {
      errors.push({ row: g.firstRow, message: `Venta ${ref}: ${vErr?.message ?? "error"}` });
      continue;
    }
    const { error: iErr } = await supabase.from("venta_items").insert(
      g.items.map((it) => ({
        venta_id: venta.id,
        producto_id: it.producto_id,
        cantidad: it.cantidad,
        precio_neto_unit: it.precio_neto_unit,
        subtotal_neto: 0,
        subtotal_bruto: 0,
        comision_item: 0,
      })),
    );
    if (iErr) {
      errors.push({ row: g.firstRow, message: `Ítems venta ${ref}: ${iErr.message}` });
      await supabase.from("ventas").delete().eq("id", venta.id);
      continue;
    }
    await supabase.rpc("recalcular_venta", { p_venta_id: venta.id });
    inserted += 1;
  }

  return { inserted, errors };
}
