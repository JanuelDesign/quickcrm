import React, { useState } from 'react';
import Papa from 'papaparse';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Eye,
  RefreshCw,
  Sparkles,
  Layers,
  UserX,
  Users,
  Check,
  FileText,
  Kanban,
  HelpCircle,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { Contacto } from '../types/crm';
import { processCsvRows, ParsedCsvResult } from '../utils/csvHelper';
import { SAMPLE_CSV_CONTENT } from '../data/sampleCsv';

interface CsvImportExportProps {
  onGoToKanban?: () => void;
  onGoToUsers?: () => void;
}

export const CsvImportExport: React.FC<CsvImportExportProps> = ({
  onGoToKanban,
  onGoToUsers,
}) => {
  const { allContacts, batchImportContacts, resetToSampleData } = useCrm();

  const [parsedResult, setParsedResult] = useState<ParsedCsvResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSummary, setImportSummary] = useState<ParsedCsvResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [cleanSyncMsg, setCleanSyncMsg] = useState<string | null>(null);

  const handleCleanSyncToFirebase = async () => {
    setIsProcessing(true);
    setCleanSyncMsg(null);
    setImportError(null);
    try {
      await resetToSampleData();
      setCleanSyncMsg('¡193 contactos reales sincronizados exitosamente a Firebase Firestore! Todos los datos antiguos de prueba fueron eliminados.');
    } catch (err: any) {
      setImportError(err.message || 'Error al sincronizar con Firebase');
    } finally {
      setIsProcessing(false);
    }
  };

  // Cargar texto CSV (sea de archivo o muestra)
  const parseRawCsvString = (csvText: string, name: string) => {
    setFileName(name);
    setImportSummary(null);
    setImportError(null);

    Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const processed = processCsvRows(results.data);
          if (processed.totalRows === 0) {
            setImportError('No se encontraron contactos válidos en el archivo.');
            setParsedResult(null);
            return;
          }
          setParsedResult(processed);
        } catch (err) {
          console.error(err);
          setImportError('Error al procesar el archivo CSV. Asegúrate de que use codificación UTF-8.');
          setParsedResult(null);
        }
      },
      error: (err) => {
        setImportError(`Error al leer el archivo: ${err.message}`);
        setParsedResult(null);
      },
    });
  };

  // Subir archivo CSV local
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseRawCsvString(text, file.name);
    };
    reader.onerror = () => {
      setImportError('Error al leer el archivo del disco.');
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Cargar directamente el dataset real "Contactos_AI_Studio_App.csv"
  const handleLoadSampleFile = () => {
    parseRawCsvString(SAMPLE_CSV_CONTENT, 'Contactos_AI_Studio_App.csv');
  };

  // Confirmar y subir a Firestore
  const handleConfirmImport = async () => {
    if (!parsedResult || parsedResult.contacts.length === 0) return;
    setIsProcessing(true);
    setImportError(null);
    try {
      await batchImportContacts(parsedResult.contacts);
      setImportSummary(parsedResult);
      setParsedResult(null);
      setFileName('');
    } catch (err) {
      setImportError('Error al guardar en Firestore. Intenta de nuevo.');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Descargar archivo real Contactos_AI_Studio_App.csv
  const handleDownloadSampleCsv = () => {
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Contactos_AI_Studio_App.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportar base de datos completa a CSV
  const handleExportAll = () => {
    const dataToExport = allContacts.map((c) => ({
      Nombre: c.nombre,
      Teléfono: c.telefono,
      Correo: c.correo || '',
      Dirección: c.direccion || '',
      'Tipo de Cliente': c.tipoCliente,
      'Etapa Original (CRM)': c.etapa,
      'Última Compra': c.ultimaCompra ? c.ultimaCompra.slice(0, 10) : '',
      'Rol/Cargo': c.rolCargo,
      'Veces que Compró': c.vecesQueCompro || '',
      'Estado de Contacto': c.estadoContacto,
      'Fecha Último Contacto': c.fechaUltimoContacto ? c.fechaUltimoContacto.slice(0, 10) : '',
      'Próximo Seguimiento': c.proximoSeguimiento ? c.proximoSeguimiento.slice(0, 10) : '',
      Notas: Array.isArray(c.notas) ? c.notas.map((n) => n.texto).join(' | ') : c.notas || '',
      Responsable: c.responsable,
    }));

    const csvString = Papa.unparse(dataToExport);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Contactos_AI_Studio_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#FF8407]">
            Herramientas Administrativas
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Importador de Contactos CSV
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Optimizado para <strong>Contactos_AI_Studio_App.csv</strong> con 14 columnas exactas, teléfonos E.164, fechas AAAA-MM-DD y generación automática de columnas Kanban para etapas no estándar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadSampleCsv}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition"
            title="Descargar archivo real Contactos_AI_Studio_App.csv"
          >
            <Download className="w-4 h-4 text-[#FF8407]" />
            <span>Descargar CSV Real</span>
          </button>

          <button
            onClick={handleExportAll}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Todo ({allContacts.length})</span>
          </button>
        </div>
      </div>

      {/* Estado actual de la Base de Datos */}
      <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-50/50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Base de Datos Firestore Sincronizada
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[11px]">
                {allContacts.length} contactos
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Datos reales de <strong>Contactos_AI_Studio_App.csv</strong> activos en tiempo real. Todos los contactos de prueba ficticios anteriores fueron purgados.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCleanSyncToFirebase}
          disabled={isProcessing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition active:scale-98 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
          <span>{isProcessing ? 'Sincronizando...' : 'Re-sincronizar Limpio a Firebase'}</span>
        </button>
      </div>

      {cleanSyncMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-bold animate-in fade-in">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{cleanSyncMsg}</span>
        </div>
      )}

      {/* Tarjeta de Resumen después de Importar */}
      {importSummary && (
        <div className="bg-white rounded-2xl border-2 border-emerald-500/80 shadow-md p-6 animate-in fade-in space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  Importación Completada con Éxito
                </span>
                <h2 className="text-xl font-black text-slate-900">
                  Resumen de la Importación
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Los registros fueron guardados en Firestore en tiempo real y sincronizados con el tablero.
                </p>
              </div>
            </div>

            <button
              onClick={() => setImportSummary(null)}
              className="text-xs text-slate-400 hover:text-slate-600 p-1"
            >
              ✕ Cerrar resumen
            </button>
          </div>

          {/* 3 Métricas Principales requeridas por el usuario */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Total Creados */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Contactos Creados
                </span>
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-3xl font-black text-slate-900 mt-2">
                {importSummary.totalRows}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Insertados con teléfonos y fechas AAAA-MM-DD tal cual.
              </p>
            </div>

            {/* 2. Sin Asignar */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                  Sin Asignar
                </span>
                <UserX className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-3xl font-black text-amber-900 mt-2">
                {importSummary.sinAsignarCount}
              </div>
              <p className="text-[11px] text-amber-700 mt-1">
                Listos para repartir manualmente entre el equipo de ventas.
              </p>
            </div>

            {/* 3. Etapas No Estándar */}
            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">
                  Etapas No Estándar
                </span>
                <Layers className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-3xl font-black text-purple-900 mt-2">
                {importSummary.noEstandarCount}
              </div>
              <p className="text-[11px] text-purple-700 mt-1">
                Mostradas automáticamente como nuevas columnas en el Kanban.
              </p>
            </div>
          </div>

          {/* Desglose de Etapas no estándar */}
          {importSummary.noEstandarStages.length > 0 && (
            <div className="bg-purple-50/40 rounded-xl p-4 border border-purple-100 space-y-2">
              <h3 className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                <span>Columnas no estándar creadas en el Kanban:</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {importSummary.noEstandarStages.map((stg) => (
                  <div
                    key={stg.stage}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-purple-200 shadow-2xs text-xs font-bold text-purple-900"
                  >
                    <span>{stg.stage}</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px]">
                      {stg.count} contactos
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Desglose de Etapas Estándar */}
          {importSummary.standardStagesBreakdown.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Distribución en Etapas Oficiales (8 estándar):
              </h3>
              <div className="flex flex-wrap gap-2">
                {importSummary.standardStagesBreakdown.map((stg) => (
                  <div
                    key={stg.stage}
                    className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium"
                  >
                    <span>{stg.stage}</span>
                    <span className="font-bold text-slate-900 bg-white px-1.5 py-0.2 rounded border border-slate-200 text-[11px]">
                      {stg.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botones de acción rápida */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            {onGoToKanban && (
              <button
                onClick={onGoToKanban}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF8407] hover:bg-[#E57300] text-white text-xs font-bold shadow-xs transition"
              >
                <Kanban className="w-4 h-4" />
                <span>Ir al Kanban (Ver nuevas columnas)</span>
              </button>
            )}

            {onGoToUsers && (
              <button
                onClick={onGoToUsers}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition"
              >
                <Users className="w-4 h-4" />
                <span>Ir a Gestión de Usuarios (Repartir)</span>
              </button>
            )}

            <button
              onClick={() => setImportSummary(null)}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
            >
              Importar otro archivo
            </button>
          </div>
        </div>
      )}

      {/* Sección de Carga */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#FF8407]" />
            <span>Subir Archivo CSV</span>
          </h2>

          {/* Botón de 1-Clic para cargar archivo real */}
          <button
            type="button"
            onClick={handleLoadSampleFile}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-[#FF8407] text-xs font-bold transition active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>Cargar Contactos_AI_Studio_App.csv (193 contactos reales)</span>
          </button>
        </div>

        {/* Zona Drag and Drop */}
        <label
          htmlFor="csv-file-input"
          className="border-2 border-dashed border-slate-300 hover:border-[#FF8407] rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-orange-50/20 transition text-center"
        >
          <FileSpreadsheet className="w-12 h-12 text-[#FF8407] mb-2" />
          <span className="font-bold text-slate-900 text-sm">
            {fileName ? `Archivo cargado: ${fileName}` : 'Haz clic para seleccionar o arrastra Contactos_AI_Studio_App.csv'}
          </span>
          <span className="text-xs text-slate-500 mt-1 max-w-md">
            14 columnas: Nombre, Teléfono, Correo, Dirección, Tipo de Cliente, Etapa Original (CRM), Última Compra, Rol/Cargo, Veces que Compró, Estado, Fecha Contacto, Próximo Seguimiento, Notas, Responsable.
          </span>
          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {/* Mensaje de Error */}
        {importError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-800 text-sm font-semibold animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{importError}</span>
          </div>
        )}

        {/* Vista previa de los datos procesados antes de confirmar */}
        {parsedResult && (
          <div className="space-y-4 pt-2 animate-in fade-in">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#FF8407]" />
                  <span className="font-bold text-sm text-slate-900">
                    Vista Previa ({parsedResult.totalRows} contactos listos para insertar)
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-600 flex-wrap">
                  <span>
                    ⚠️ <strong>{parsedResult.sinAsignarCount}</strong> sin asignar
                  </span>
                  <span>•</span>
                  <span>
                    🏷️ <strong>{parsedResult.noEstandarCount}</strong> en etapas no estándar
                  </span>
                </div>
              </div>

              <button
                onClick={handleConfirmImport}
                disabled={isProcessing}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#FF8407] hover:bg-[#E57300] disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-xs transition active:scale-95 shrink-0"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Guardando {parsedResult.totalRows} contactos...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar e Importar ({parsedResult.totalRows} contactos)</span>
                  </>
                )}
              </button>
            </div>

            {/* Tabla de primeras filas */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-80">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-600 uppercase font-bold text-[10px] sticky top-0">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Teléfono (E.164)</th>
                    <th className="p-3">Tipo Cliente</th>
                    <th className="p-3">Etapa CRM</th>
                    <th className="p-3">Rol / Cargo</th>
                    <th className="p-3">Última Compra</th>
                    <th className="p-3">Responsable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedResult.contacts.slice(0, 15).map((row, idx) => {
                    const isExtra = !row.etapa.startsWith('A1') &&
                      !row.etapa.startsWith('C3') &&
                      !row.etapa.startsWith('E5') &&
                      !row.etapa.startsWith('H8') &&
                      !row.etapa.startsWith('I9') &&
                      !row.etapa.startsWith('J10') &&
                      !row.etapa.startsWith('K11') &&
                      !row.etapa.startsWith('N14');

                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{row.nombre}</td>
                        <td className="p-3 font-mono text-slate-700">{row.telefono}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                            {row.tipoCliente}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              isExtra
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {row.etapa}
                            {isExtra && ' (Nueva columna)'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{row.rolCargo}</td>
                        <td className="p-3 text-slate-500 font-mono">
                          {row.ultimaCompra ? row.ultimaCompra.slice(0, 10) : '—'}
                        </td>
                        <td className="p-3">
                          <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-semibold text-[10px]">
                            {row.responsable}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {parsedResult.totalRows > 15 && (
              <p className="text-xs text-slate-400 text-center italic">
                ... y {parsedResult.totalRows - 15} contactos más listos para importar.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Reglas y Guía de Columnas */}
      <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200 text-xs text-slate-600 space-y-2">
        <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-[#FF8407]" />
          <span>Reglas aplicadas al procesar Contactos_AI_Studio_App.csv:</span>
        </h3>
        <ul className="list-disc list-inside space-y-1 pl-1 text-slate-600">
          <li><strong>Teléfonos:</strong> Vienen normalizados en E.164 (+1XXXXXXXXXX) y deduplicados; se guardan tal cual.</li>
          <li><strong>Fechas:</strong> Interpretadas en formato AAAA-MM-DD sin alterar el día por zona horaria.</li>
          <li><strong>Responsable vacío:</strong> Se asigna automáticamente como <em>"Sin asignar"</em> para reparto posterior.</li>
          <li><strong>Etapas no estándar:</strong> (ej. <em>D4 RE-MARKETING</em>, <em>RUBEN CLIENTE</em>) se crean como columnas adicionales en el Kanban.</li>
        </ul>
      </div>
    </div>
  );
};
