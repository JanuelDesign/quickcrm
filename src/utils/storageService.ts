import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { AdjuntoNota } from '../types/crm';

export interface UploadAttachmentParams {
  contactoId: string;
  notaId: string;
  blob: Blob;
  tipo: 'llamada' | 'mensaje' | 'pdf';
  fileName?: string;
}

/**
 * Sube una captura o cotización PDF a Firebase Storage en la ruta:
 * `capturas/{contactoId}/{notaId}-{timestamp}.{jpg|pdf}`
 *
 * Retorna el objeto AdjuntoNota con la URL de descarga y el path interno.
 */
export async function uploadNotaAttachment({
  contactoId,
  notaId,
  blob,
  tipo,
  fileName,
}: UploadAttachmentParams): Promise<AdjuntoNota> {
  const isPdf = blob.type === 'application/pdf' || (fileName && fileName.toLowerCase().endsWith('.pdf'));
  const extension = isPdf ? 'pdf' : 'jpg';
  const contentType = isPdf ? 'application/pdf' : 'image/jpeg';
  const resolvedTipo = isPdf ? 'pdf' : tipo;

  const timestamp = Date.now();
  const storagePath = `capturas/${contactoId}/${notaId}-${timestamp}.${extension}`;
  const storageRef = ref(storage, storagePath);

  const snapshot = await uploadBytes(storageRef, blob, {
    contentType,
    customMetadata: {
      tipo: resolvedTipo,
      contactoId,
      notaId,
      nombreOriginal: fileName || (isPdf ? 'cotizacion.pdf' : 'captura.jpg'),
      subidoEn: new Date().toISOString(),
    },
  });

  const downloadUrl = await getDownloadURL(snapshot.ref);

  return {
    url: downloadUrl,
    tipo: resolvedTipo,
    storagePath,
    nombreArchivo: fileName || (isPdf ? 'Cotización QuickQuote.pdf' : 'Captura.jpg'),
    tamanoBytes: blob.size,
  };
}
