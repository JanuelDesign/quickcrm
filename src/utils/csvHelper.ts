import { Contacto, PIPELINE_STAGES, TipoCliente, RolCargo, VecesQueCompro, EstadoContacto } from '../types/crm';

export interface ParsedCsvResult {
  contacts: Omit<Contacto, 'id' | 'creadoEn' | 'actualizadoEn'>[];
  totalRows: number;
  sinAsignarCount: number;
  noEstandarCount: number;
  noEstandarStages: { stage: string; count: number }[];
  standardStagesBreakdown: { stage: string; count: number }[];
}

/**
 * Normaliza y empareja la Etapa Original con las 8 estándar del Kanban.
 * Si no coincide con ninguna de las 8, la conserva tal cual como etapa no estándar.
 */
export function matchStage(rawEtapa?: string): { stage: string; isStandard: boolean } {
  if (!rawEtapa || !rawEtapa.trim()) {
    return { stage: 'A1 — Base de Datos', isStandard: true };
  }
  const clean = rawEtapa.trim();

  // Buscar coincidencia con el código o nombre de las 8 etapas oficiales
  for (const stg of PIPELINE_STAGES) {
    if (
      clean.toUpperCase() === stg.label.toUpperCase() ||
      clean.toUpperCase() === stg.code.toUpperCase() ||
      clean.toUpperCase().startsWith(stg.code.toUpperCase() + ' ') ||
      clean.toUpperCase().startsWith(stg.code.toUpperCase() + ' —') ||
      clean.toUpperCase().startsWith(stg.code.toUpperCase() + ' -')
    ) {
      return { stage: stg.label, isStandard: true };
    }
  }

  // Etapa no estándar (ej: "D4 RE-MARKETING", "RUBEN CLIENTE")
  return { stage: clean, isStandard: false };
}

/**
 * Parsea fechas que vienen en formato estricto AAAA-MM-DD
 * No asume DD/MM/AAAA. Si viene vacía o no válida retorna undefined.
 */
export function parseDateAaaaMmDd(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  const trimmed = dateStr.trim();
  if (!trimmed) return undefined;

  // Extraer año, mes, día con regex para no sufrir desfases horarios
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    const year = parseInt(y, 10);
    const month = parseInt(m, 10);
    const day = parseInt(d, 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      // Guardar con hora mediodía UTC para consistencia
      return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
    }
  }
  return undefined;
}

/**
 * Parsea el responsable. Si viene vacío o en blanco, queda como 'sin asignar'
 */
export function parseResponsable(rawResp?: string): string {
  if (!rawResp) return 'sin asignar';
  const trimmed = rawResp.trim();
  if (!trimmed || trimmed.toLowerCase() === 'sin asignar' || trimmed.toLowerCase() === 'unassigned') {
    return 'sin asignar';
  }
  if (trimmed.toLowerCase().includes('laura')) {
    return 'Ruben Valverde (Vendedor)';
  }
  if (trimmed.toLowerCase().includes('roberto')) {
    return 'Esteban Gavotti (Admin)';
  }
  return trimmed;
}

/**
 * Normaliza y mapea las 14 columnas de Contactos_AI_Studio_App.csv
 */
export function processCsvRows(rows: Record<string, string>[]): ParsedCsvResult {
  const contacts: Omit<Contacto, 'id' | 'creadoEn' | 'actualizadoEn'>[] = [];
  let sinAsignarCount = 0;
  let noEstandarCount = 0;
  const noEstandarMap = new Map<string, number>();
  const standardMap = new Map<string, number>();

  rows.forEach((row, idx) => {
    // 1. Nombre (persona o empresa)
    const nombre = (row['Nombre'] || row['nombre'] || row['Name'] || '').trim();
    if (!nombre) return; // Omitir filas sin nombre

    // 2. Teléfono (ya viene en E.164 ej: +17862663804 sin espacios, insertar tal cual)
    const telefono = (row['Teléfono'] || row['Telefono'] || row['telefono'] || row['Phone'] || '').trim();

    // 3. Correo (texto, puede venir vacío)
    const correo = (row['Correo'] || row['correo'] || row['Email'] || '').trim() || undefined;

    // 4. Dirección (texto libre en una sola celda, puede venir vacío)
    const direccion = (row['Dirección'] || row['Direccion'] || row['direccion'] || row['Address'] || '').trim() || undefined;

    // 5. Tipo de Cliente: "VIP", "Compró Antes", "Contactado sin Compra", "Nunca Contactado", o vacío
    const rawTipo = (row['Tipo de Cliente'] || row['tipoCliente'] || '').trim();
    const validTipos: TipoCliente[] = ['VIP', 'Compró Antes', 'Contactado sin Compra', 'Nunca Contactado'];
    const tipoCliente: TipoCliente = validTipos.includes(rawTipo as TipoCliente)
      ? (rawTipo as TipoCliente)
      : 'Nunca Contactado';

    // 6. Etapa Original (CRM)
    const rawEtapa = (row['Etapa Original (CRM)'] || row['Etapa'] || row['etapa'] || '').trim();
    const { stage, isStandard } = matchStage(rawEtapa);

    if (isStandard) {
      standardMap.set(stage, (standardMap.get(stage) || 0) + 1);
    } else {
      noEstandarCount++;
      noEstandarMap.set(stage, (noEstandarMap.get(stage) || 0) + 1);
    }

    // 7. Última Compra (AAAA-MM-DD o vacía)
    const ultimaCompra = parseDateAaaaMmDd(row['Última Compra'] || row['Ultima Compra'] || row['ultimaCompra']);

    // 8. Rol/Cargo: "General Contractor", "Installer", "Flip & Fix", "Home Owner", "Property Manager", "Handymen", "Reformas", o vacío
    let rawCargo = (row['Rol/Cargo'] || row['rolCargo'] || '').trim();
    if (rawCargo === 'Property Manger') rawCargo = 'Property Manager'; // Corregir typo común en CSV
    const validRoles: RolCargo[] = [
      'General Contractor',
      'Installer',
      'Flip & Fix',
      'Home Owner',
      'Property Manager',
      'Handymen',
      'Reformas',
    ];
    const rolCargo: RolCargo = validRoles.includes(rawCargo as RolCargo)
      ? (rawCargo as RolCargo)
      : 'Installer';

    // 9. Veces que Compró: "1 Compra", "<5 Compras", ">5 Compras", o vacío
    const rawVeces = (row['Veces que Compró'] || row['vecesQueCompro'] || '').trim();
    const validVeces: VecesQueCompro[] = ['1 Compra', '<5 Compras', '>5 Compras'];
    const vecesQueCompro: VecesQueCompro | undefined = validVeces.includes(rawVeces as VecesQueCompro)
      ? (rawVeces as VecesQueCompro)
      : undefined;

    // 10. Estado de Contacto: "Pendiente", "Interesado", o vacío
    const rawEstado = (row['Estado de Contacto'] || row['estadoContacto'] || '').trim();
    const validEstados: EstadoContacto[] = ['Pendiente', 'Interesado', 'En negociación', 'Ganado', 'Perdido'];
    const estadoContacto: EstadoContacto = validEstados.includes(rawEstado as EstadoContacto)
      ? (rawEstado as EstadoContacto)
      : 'Pendiente';

    // 11. Fecha Último Contacto (AAAA-MM-DD o vacía)
    const fechaUltimoContacto = parseDateAaaaMmDd(
      row['Fecha Último Contacto'] || row['Fecha Ultimo Contacto'] || row['fechaUltimoContacto']
    );

    // 12. Próximo Seguimiento (AAAA-MM-DD o vacía)
    const proximoSeguimiento = parseDateAaaaMmDd(
      row['Próximo Seguimiento'] || row['Proximo Seguimiento'] || row['proximoSeguimiento']
    );

    // 13. Notas (texto libre, puede venir vacío)
    const notas = (row['Notas'] || row['notas'] || '').trim();

    // 14. Responsable (casi siempre vacío -> 'sin asignar')
    let responsable = parseResponsable(row['Responsable'] || row['responsable']);
    if (stage === 'RUBEN CLIENTE' && responsable === 'sin asignar') {
      responsable = 'Ruben Valverde (Vendedor)';
    }
    if (responsable === 'sin asignar') {
      sinAsignarCount++;
    }

    contacts.push({
      nombre,
      telefono,
      correo,
      direccion,
      tipoCliente,
      etapa: stage,
      ultimaCompra,
      rolCargo,
      vecesQueCompro,
      estadoContacto,
      fechaUltimoContacto,
      proximoSeguimiento,
      notas: notas
        ? [
            {
              id: `csv_note_${Date.now()}_${idx}`,
              fecha: new Date().toISOString(),
              autor: 'Importación CSV',
              texto: notas,
            },
          ]
        : [],
      responsable,
    });
  });

  const noEstandarStages = Array.from(noEstandarMap.entries()).map(([stage, count]) => ({
    stage,
    count,
  }));

  const standardStagesBreakdown = Array.from(standardMap.entries()).map(([stage, count]) => ({
    stage,
    count,
  }));

  return {
    contacts,
    totalRows: contacts.length,
    sinAsignarCount,
    noEstandarCount,
    noEstandarStages,
    standardStagesBreakdown,
  };
}
