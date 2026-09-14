import Papa from 'papaparse';
import { SAMPLE_CSV_CONTENT } from './sampleCsv';
import { processCsvRows } from '../utils/csvHelper';
import { Contacto } from '../types/crm';

const parsed = Papa.parse<Record<string, string>>(SAMPLE_CSV_CONTENT, {
  header: true,
  skipEmptyLines: true,
});

const processed = processCsvRows(parsed.data);

/**
 * 193 Contactos reales pre-procesados de Contactos_AI_Studio_App.csv
 */
export const REAL_CSV_CONTACTS: Contacto[] = processed.contacts.map((item, index) => ({
  ...item,
  id: `real_csv_${index + 1}`,
  creadoEn: '2025-05-01T12:00:00.000Z',
  actualizadoEn: new Date().toISOString(),
}));

export const OLD_TEST_NAMES = [
  'Marcos Delgado — MD Floors LLC',
  'Alejandro Valdés — Biscayne Remodeling',
  'Elena Rostova — Flip Solutions Miami',
  'David & Sofia Gómez (Propietarios)',
  'Guillermo Cruz — GC Tile & Flooring',
  'Patricio Morales — PM Tile Contractors',
  'Hector Benítez — HB Flooring & Tile',
  'Roberto Casanova (Inversionista)',
];
