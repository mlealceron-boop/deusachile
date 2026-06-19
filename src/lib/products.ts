export interface EscalaPrecio {
  cantidadMinima: number;
  precioNeto: number;
}

export function parseProductoNombre(nombreCompleto: string) {
  if (!nombreCompleto || !nombreCompleto.includes("|")) {
    return { nombre: nombreCompleto || "", escalas: [] as EscalaPrecio[] };
  }
  const firstPipeIndex = nombreCompleto.indexOf("|");
  const nombre = nombreCompleto.substring(0, firstPipeIndex);
  const jsonEscalas = nombreCompleto.substring(firstPipeIndex + 1);
  try {
    const obj = JSON.parse(jsonEscalas);
    const escalas: EscalaPrecio[] = Object.entries(obj).map(([qty, price]) => ({
      cantidadMinima: parseInt(qty, 10),
      precioNeto: Number(price),
    })).sort((a, b) => a.cantidadMinima - b.cantidadMinima);
    return { nombre, escalas };
  } catch {
    return { nombre: nombreCompleto, escalas: [] as EscalaPrecio[] };
  }
}

export function encodeProductoNombre(nombre: string, escalas: EscalaPrecio[]) {
  const cleanNombre = nombre.includes("|") ? nombre.split("|")[0] : nombre;
  if (!escalas || escalas.length === 0) return cleanNombre.trim();
  
  const obj: Record<string, number> = {};
  escalas
    .filter(e => e.cantidadMinima > 0 && e.precioNeto >= 0)
    .forEach((e) => {
      obj[e.cantidadMinima.toString()] = e.precioNeto;
    });
  
  if (Object.keys(obj).length === 0) return cleanNombre.trim();
  return `${cleanNombre.trim()}|${JSON.stringify(obj)}`;
}

export function obtenerPrecioPorVolumen(escalas: EscalaPrecio[], cantidad: number, precioReferencia: number): number {
  if (!escalas || escalas.length === 0) return precioReferencia;
  
  let precio = precioReferencia;
  // escalas are already sorted by cantidadMinima ascending
  for (const escala of escalas) {
    if (cantidad >= escala.cantidadMinima) {
      precio = escala.precioNeto;
    }
  }
  return precio;
}

export function formatCLP(val: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}
