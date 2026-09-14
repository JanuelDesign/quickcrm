import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { AdjuntoNota } from '../types/crm';

export interface UploadAttachmentParams {
  contactoId: string;
  notaId: string;
  blob: Blob;
  tipo: 'llamada' | 'mensaje';
}

/**
 * Sube una captura comprimida a Firebase Storage en la ruta:
 * `capturas/{contactoId}/{notaId}-{timestamp}.jpg`
 *
 * Retorna el objeto AdjuntoNota con la URL de descarga y el path interno.
 */
export async function uploadNotaAttachment({
  contactoId,
  notaId,
  blob,
  tipo,
}: UploadAttachmentParams): Promise<AdjuntoNota> {
  const timestamp = Date.now();
  const storagePath = `capturas/${contactoId}/${notaId}-${timestamp}.jpg`;
  const storageRef = ref(storage, storagePath);

  const snapshot = await uploadBytes(storageRef, blob, {
    contentType: 'image/jpeg',
    customMetadata: {
      tipo,
      contactoId,
      notaId,
      subidoEn: new Date().toISOString(),
    },
  });

  const downloadUrl = await getDownloadURL(snapshot.ref);

  return {
    url: downloadUrl,
    tipo,
    storagePath,
  };
}
