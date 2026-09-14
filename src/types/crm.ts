export type TipoCliente = 'VIP' | 'Compró Antes' | 'Contactado sin Compra' | 'Nunca Contactado';

export type RolCargo =
  | 'General Contractor'
  | 'Installer'
  | 'Flip & Fix'
  | 'Home Owner'
  | 'Property Manager'
  | 'Handymen'
  | 'Reformas';

export type VecesQueCompro = '1 Compra' | '<5 Compras' | '>5 Compras';

export type EstadoContacto = 'Pendiente' | 'Interesado' | 'En negociación' | 'Ganado' | 'Perdido';

export type UserRole = 'admin' | 'vendedor';

export interface AdjuntoNota {
  url: string;
  tipo: 'llamada' | 'mensaje';
  storagePath: string;
}

export interface NotaHistorial {
  id: string;
  fecha: string; // ISO string
  autor: string;
  texto: string;
  adjuntos?: AdjuntoNota[];
}

export interface Contacto {
  id: string;
  nombre: string;
  telefono: string;
  correo?: string;
  direccion?: string;
  tipoCliente: TipoCliente;
  etapa: string; // "CÓDIGO NOMBRE" e.g. "A1 — Base de Datos"
  segmento?: string; // Clasificación post-venta e.g. "H8 — Regular Oxidado", "K11 — VIP Asociado", etc.
  ultimaCompra?: string;
  rolCargo: RolCargo;
  vecesQueCompro?: VecesQueCompro;
  estadoContacto: EstadoContacto;
  fechaUltimoContacto?: string;
  proximoSeguimiento?: string;
  notas?: string | NotaHistorial[];
  responsable: string; // UID or email or Name or 'sin asignar'
  creadoEn: string;
  actualizadoEn: string;
}

export interface UsuarioCRM {
  uid: string;
  email: string;
  nombre: string;
  rol: UserRole;
  activo: boolean;
  creadoEn: string;
  telefono?: string;
}

export interface PipelineStage {
  id: string;
  code: string;
  nombre: string;
  label: string;
  description: string;
  color: string;
  bgLight: string;
}

// 1. Embudo de venta (secuencial, un contacto pasa por una etapa a la vez antes de la venta)
export const FUNNEL_STAGES: PipelineStage[] = [
  {
    id: 'A1',
    code: 'A1',
    nombre: 'Base de Datos',
    label: 'A1 — Base de Datos',
    description: 'Contactos importados o nuevos sin calificar',
    color: '#64748B', // Slate
    bgLight: 'bg-slate-50 border-slate-200 text-slate-700',
  },
  {
    id: 'C3',
    code: 'C3',
    nombre: 'Info Enviada',
    label: 'C3 — Info Enviada',
    description: 'Catálogo de SPC, tile o samples compartidos',
    color: '#0284C7', // Sky
    bgLight: 'bg-sky-50 border-sky-200 text-sky-700',
  },
  {
    id: 'E5',
    code: 'E5',
    nombre: 'Interesado',
    label: 'E5 — Interesado',
    description: 'Pidiendo cotización o metraje para obra/proyecto',
    color: '#D97706', // Amber
    bgLight: 'bg-amber-50 border-amber-200 text-amber-700',
  },
  {
    id: 'F6',
    code: 'F6',
    nombre: 'Cotización Enviada',
    label: 'F6 — Cotización Enviada',
    description: 'Presupuesto emitido en espera de respuesta (disparador QuickQuote)',
    color: '#EA580C', // Ámbar / Naranja quemado distintivo
    bgLight: 'bg-orange-50 border-orange-200 text-orange-800',
  },
];

// 2. Segmento de cliente (clasificación post-venta por comportamiento)
export const CLIENT_SEGMENTS: PipelineStage[] = [
  {
    id: 'H8',
    code: 'H8',
    nombre: 'Regular Oxidado',
    label: 'H8 — Regular Oxidado',
    description: 'Cliente previo sin compras recientes en >60 días',
    color: '#DC2626', // Red
    bgLight: 'bg-red-50 border-red-200 text-red-700',
  },
  {
    id: 'I9',
    code: 'I9',
    nombre: 'Regular Recurrente',
    label: 'I9 — Regular Recurrente',
    description: 'Instalador o contratista activo con pedidos frecuentes',
    color: '#2563EB', // Blue
    bgLight: 'bg-blue-50 border-blue-200 text-blue-700',
  },
  {
    id: 'J10',
    code: 'J10',
    nombre: 'Recompra B2B',
    label: 'J10 — Recompra B2B',
    description: 'Cuentas comerciales, flippers y property managers',
    color: '#7C3AED', // Violet
    bgLight: 'bg-purple-50 border-purple-200 text-purple-700',
  },
  {
    id: 'K11',
    code: 'K11',
    nombre: 'VIP Asociado',
    label: 'K11 — VIP Asociado',
    description: 'Grandes cuentas y distribuidores clave de Quicksurfaces',
    color: '#FF8407', // Quicksurfaces Brand Orange
    bgLight: 'bg-orange-50 border-orange-200 text-[#FF8407]',
  },
  {
    id: 'N14',
    code: 'N14',
    nombre: 'Home Owner',
    label: 'N14 — Home Owner',
    description: 'Propietario residencial directo para remodelación',
    color: '#059669', // Emerald
    bgLight: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  },
];

// Mantenemos PIPELINE_STAGES unificado para compatibilidad general
export const PIPELINE_STAGES: PipelineStage[] = [...FUNNEL_STAGES, ...CLIENT_SEGMENTS];

export const TIPOS_CLIENTE: TipoCliente[] = [
  'VIP',
  'Compró Antes',
  'Contactado sin Compra',
  'Nunca Contactado',
];

export const ROLES_CARGO: RolCargo[] = [
  'General Contractor',
  'Installer',
  'Flip & Fix',
  'Home Owner',
  'Property Manager',
  'Handymen',
  'Reformas',
];

export const VECES_COMPRO: VecesQueCompro[] = [
  '1 Compra',
  '<5 Compras',
  '>5 Compras',
];

export const ESTADOS_CONTACTO: EstadoContacto[] = [
  'Pendiente',
  'Interesado',
  'En negociación',
  'Ganado',
  'Perdido',
];
