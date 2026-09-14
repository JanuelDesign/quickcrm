// Helper utilities for QuickCRM

export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  const cleaned = ('' + phone).replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export function getCleanPhoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  let cleaned = ('' + phone).replace(/\D/g, '');
  // Default to US +1 if 10 digits
  if (cleaned.length === 10) {
    cleaned = '1' + cleaned;
  }
  return cleaned;
}

export function createWhatsAppUrl(phone: string, clientName: string): string {
  const cleanPhone = getCleanPhoneForWhatsApp(phone);
  const text = encodeURIComponent(
    `Hola ${clientName}, te escribo de Quicksurfaces Miami sobre pisos vinil SPC, tile y molduras. ¿Cómo va tu proyecto?`
  );
  return `https://wa.me/${cleanPhone}?text=${text}`;
}

export function formatDateSpanish(dateString?: string | null): string {
  if (!dateString) return 'No registrado';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatDateTimeSpanish(dateString?: string | null): string {
  if (!dateString) return 'No programado';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function isFollowUpOverdue(dateString?: string | null): boolean {
  if (!dateString) return false;
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    // Compare dates: overdue if before the start of today or before current time
    return d.getTime() < now.getTime();
  } catch {
    return false;
  }
}

export function isFollowUpToday(dateString?: string | null): boolean {
  if (!dateString) return false;
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  } catch {
    return false;
  }
}

export function daysSinceLastContact(dateString?: string | null): number | null {
  if (!dateString) return null;
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return null;
    const diffMs = Date.now() - d.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}
