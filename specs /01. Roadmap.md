# ARQUITECTURA MASTER — Sistema Comercial DEUSA

> **Propósito:** Documento de referencia completo. NO es un prompt. Es el contrato que gobierna todo el desarrollo.
> **Herramienta:** Google Antigravity conectado a Supabase existente.
> **Metodología:** Spec-Driven Development (SDD) — una fase a la vez, validar antes de avanzar.

---

## 1. Qué es DEUSA

Empresa chilena de importación y comercialización de productos de medicina estética. Vende a médicos, enfermeras y clínicas. Su diferencial es cercanía, rapidez y acompañamiento comercial.

## 2. Qué es esta app

Sistema comercial interno para gestionar: clientes, ventas, inventario, tareas comerciales, comisiones de vendedores y seguimiento de capacitación. Lo usan el Director (admin) y 3-5 ejecutivos comerciales.

## 3. Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React + Vite + Tailwind (Antigravity) |
| Backend / DB | Supabase (Postgres) — YA EXISTENTE |
| Auth | Supabase Auth con roles (admin / ejecutivo) |
| Permisos | Row Level Security (RLS) en Supabase |
| Idioma UI | Español |

## 4. Roles

| Rol | Permisos |
|-----|----------|
| admin | Ve y gestiona TODO. Crea usuarios, configura comisiones, administra catálogo e inventario. |
| ejecutivo | Ve y gestiona SOLO su cartera: sus clientes, tareas, reuniones, ventas. No ve datos de otros ejecutivos. |

## 5. Base de datos existente (YA CREADA en Supabase)

### Tablas que YA EXISTEN — NO recrear:

**usuarios** (id uuid PK, nombre text, email text, activo boolean, creado_en timestamptz)
**user_roles** (id uuid PK, user_id uuid FK→usuarios, role enum: admin|ejecutivo)
**clientes** (id uuid PK, nombre text, clinica text, contacto text, tipo enum: clinica_propia|recien_empieza, estado enum: prospecto|activo|inactivo, ejecutivo_id uuid FK→usuarios, creado_en timestamptz)
**interacciones** (id uuid PK, cliente_id uuid FK, usuario_id uuid FK, nota text, fecha timestamptz)
**marcas** (id uuid PK, nombre text, activo boolean, creado_en timestamptz)
**productos** (id uuid PK, marca_id uuid FK→marcas, nombre text, precio_referencia numeric(12,2), costo_referencia numeric(12,2), activo boolean, creado_en timestamptz)
**config_comision** (id uuid PK, porcentaje numeric(5,2) DEFAULT 8.00, vigente_desde timestamptz)
**ventas** (id uuid PK, cliente_id uuid FK, ejecutivo_id uuid FK, fecha timestamptz, total_neto numeric(14,2), total_bruto numeric(14,2), total_comision numeric(14,2), porcentaje_comision numeric(5,2), creado_por uuid FK, creado_en timestamptz)
**venta_items** (id uuid PK, venta_id uuid FK→ventas ON DELETE CASCADE, producto_id uuid FK→productos, cantidad integer CHECK >0, precio_neto_unit numeric(12,2), subtotal_neto numeric(14,2), subtotal_bruto numeric(14,2), comision_item numeric(14,2))

**Función existente:** has_role(user_id, role_name) → boolean
**Función existente:** recalcular_venta(venta_id) → void (recalcula totales de cabecera desde ítems)

**RLS activo en TODAS las tablas.** Regla: ejecutivo solo ve registros donde ejecutivo_id = auth.uid(). Admin ve todo.

### Tablas que FALTAN por crear (se crean en fases posteriores):

- tareas
- reuniones
- inventario
- movimientos_inventario
- modulos_capacitacion
- progreso_capacitacion
- auditoria

### Datos precargados:

**8 marcas:** AesPlla, Regenovue, LactoExoColla, NadExoColla, Pure Pro, Pure Eyes, Atlantis Hair, SelastinTox GF11
**10 productos (SKUs):** AesPlla, Regenovue Fine Plus, Regenovue Deep Plus, Regenovue Sub Q Plus, LactoExoColla, NadExoColla, Pure Pro, Pure Eyes, Atlantis Hair, SelastinTox GF11

## 6. Reglas de negocio clave

- **Comisión:** 8% sobre venta neta, configurable, congelada por venta.
- **IVA:** usuario ingresa neto por ítem; bruto = neto × 1.19 (calculado).
- **Ventas:** estructura cabecera + detalle (multi-producto).
- **Inventario PPM:** cada entrada recalcula precio promedio ponderado; cada salida (venta) usa el PPM vigente.
- **Bloqueo de stock:** NO se puede registrar una venta si no hay stock suficiente del producto.
- **Aislamiento de datos:** un ejecutivo NUNCA ve la cartera de otro (RLS en base de datos, no solo en frontend).

## 7. Fases de construcción

| Fase | Contenido | Estado |
|------|-----------|--------|
| 0 | Conexión Antigravity ↔ Supabase existente | Pendiente |
| 1 | UI: Login, Usuarios, Clientes, Interacciones | Tablas OK, UI pendiente |
| 2A | UI: Catálogo (Marcas + Productos) + Registro de Ventas | Tablas OK, UI pendiente |
| 2B | Tareas a vendedores + Reuniones con clientes | TODO pendiente |
| 2.5 | Inventario PPM + conexión venta→descuento stock | TODO pendiente |
| 3 | Dashboard comercial + Comisiones + Ranking | TODO pendiente |
| 4 | Capacitación (LMS-lite) + Auditoría | TODO pendiente |

## 8. Pantallas del MVP

1. Login
2. Dashboard (admin: global / ejecutivo: su vista)
3. Clientes (lista + ficha + historial interacciones)
4. Catálogo (admin: marcas + productos CRUD)
5. Ventas (registrar multi-producto + listado)
6. Tareas (asignar + listar + estados)
7. Reuniones (agendar + agenda)
8. Inventario (stock + movimientos + alertas)
9. Comisiones y Ranking
10. Capacitación (módulos + progreso)
11. Usuarios (admin: gestión equipo)
12. Auditoría (admin: log de acciones)
