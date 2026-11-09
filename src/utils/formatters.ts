// Helper utilities for QuickCRM
import { Contacto, UsuarioCRM } from '../types/crm';

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

/**
 * Normaliza texto eliminando acentos, diacríticos y convirtiendo a minúsculas
 * Ej: "Núñez" -> "nunez", "José" -> "jose"
 */
export function normalizeSearchText(text?: string | null): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Verifica si un contacto no tiene responsable asignado todavía
 */
export function isContactUnassigned(contact?: Partial<Contacto> | null): boolean {
  if (!contact || !contact.responsable) return true;
  const r = contact.responsable.toLowerCase().trim();
  return r === '' || r === 'sin asignar' || r === 'unassigned';
}

/**
 * Limpia y normaliza cadenas para comparar nombres de usuarios y responsables
 * Quita sufijos de rol como '(Vendedor)', '(Admin)', etc.
 */
function cleanRoleSuffix(str: string): string {
  return str
    .replace(/\(vendedor\)/gi, '')
    .replace(/\(admin\)/gi, '')
    .replace(/\(administrador\)/gi, '')
    .replace(/@.*$/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Determina si un contacto está asignado a un usuario específico de forma robusta,
 * verificando ID de Firestore, UID de Auth, correo o nombre con o sin rol.
 */
export function isContactAssignedToUser(
  contact: Contacto,
  user: UsuarioCRM | null,
  allUsers?: UsuarioCRM[]
): boolean {
  if (!user || !contact) return false;
  if (isContactUnassigned(contact)) return false;

  const resp = (contact.responsable || '').trim();
  const respLower = resp.toLowerCase();

  // 1. Coincidencia directa por responsableId o UID
  if (contact.responsableId && (contact.responsableId === user.uid || contact.responsableId === user.email)) {
    return true;
  }
  if (resp === user.uid || respLower === user.uid.toLowerCase()) {
    return true;
  }

  // 2. Coincidencia por correo electrónico
  const userEmail = (user.email || '').toLowerCase().trim();
  if (userEmail && (respLower === userEmail || respLower.includes(userEmail))) {
    return true;
  }

  // 3. Coincidencia por nombre normalizado (ignorando mayúsculas, acentos, números y sufijos de rol)
  const cleanResp = cleanRoleSuffix(resp);
  const cleanUserName = cleanRoleSuffix(user.nombre || '');

  if (cleanResp && cleanUserName) {
    if (cleanResp === cleanUserName) return true;
    if (cleanResp.includes(cleanUserName) || cleanUserName.includes(cleanResp)) return true;

    // Comparar sin espacios ni números (ej. 'rubenvalverde2303' con 'ruben valverde')
    const noSpaceResp = cleanResp.replace(/[\s\d_-]/g, '');
    const noSpaceUser = cleanUserName.replace(/[\s\d_-]/g, '');
    if (noSpaceResp && noSpaceUser && (noSpaceResp === noSpaceUser || noSpaceResp.includes(noSpaceUser) || noSpaceUser.includes(noSpaceResp))) {
      return true;
    }

    // Coincidencia con prefijo de email
    const emailPrefix = userEmail.split('@')[0].replace(/[\s\d_-]/g, '');
    if (emailPrefix && (noSpaceResp === emailPrefix || noSpaceResp.includes(emailPrefix) || emailPrefix.includes(noSpaceResp))) {
      return true;
    }

    // Comparar por tokens (ej. 'Ruben' y 'Valverde')
    const respTokens = cleanResp.split(/\s+/).filter(Boolean);
    const userTokens = cleanUserName.split(/\s+/).filter(Boolean);

    if (respTokens.length > 0 && userTokens.length > 0) {
      if (respTokens[0] === userTokens[0]) {
        if (respTokens.length === 1 || userTokens.length === 1) return true;
        if (respTokens.slice(1).some((t) => userTokens.slice(1).includes(t))) return true;
      }
    }
  }

  // 4. Si se provee la lista de usuarios del sistema, cotejar alias
  if (allUsers && allUsers.length > 0) {
    const matchedUser = allUsers.find(
      (u) =>
        u.uid === user.uid ||
        cleanRoleSuffix(u.nombre) === cleanUserName ||
        (u.email && u.email.toLowerCase() === userEmail)
    );
    if (matchedUser) {
      if (
        cleanRoleSuffix(matchedUser.nombre) === cleanResp ||
        (matchedUser.email && cleanResp === matchedUser.email.toLowerCase()) ||
        matchedUser.uid === resp
      ) {
        return true;
      }
    }
  }

  return false;
}

