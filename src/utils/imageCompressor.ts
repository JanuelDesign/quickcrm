/**
 * Utilidad para comprimir y redimensionar capturas de llamadas y mensajes
 * en el navegador antes de subirlas a Firebase Storage.
 *
 * Especificación:
 * - Redimensionamiento con <canvas> a un ancho máximo de 1280px (manteniendo relación de aspecto)
 * - Calidad de compresión JPEG ~75% (0.75)
 * - Reduce el peso 3 a 5 veces sin perder legibilidad del texto de WhatsApp o llamadas
 */

export interface CompressionResult {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
}

export async function compressImage(
  file: File,
  maxWidth = 1280,
  quality = 0.75
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    // Validar que sea imagen
    if (!file.type.startsWith('image/')) {
      reject(new Error('El archivo seleccionado no es una imagen válida.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error al leer el archivo de imagen.'));

    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Error al cargar la imagen en el elemento Image.'));

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Si el ancho excede el máximo permitido, escalar proporcionalmente
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo inicializar el contexto 2D de renderizado.'));
          return;
        }

        // Rellenar fondo blanco para evitar artefactos negros en capturas con transparencia PNG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Suavizado de alta calidad para preservar legibilidad de texto en capturas
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('No se pudo generar el Blob comprimido de la imagen.'));
              return;
            }

            const previewUrl = URL.createObjectURL(blob);
            resolve({
              blob,
              previewUrl,
              width,
              height,
              originalSize: file.size,
              compressedSize: blob.size,
            });
          },
          'image/jpeg',
          quality
        );
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
