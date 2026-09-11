/**
 * Tipos/tamanhos de mídia aceitos para anexo manual nas conversas de
 * WhatsApp — segue os limites oficiais da Meta Cloud API.
 *
 * A Meta só aceita webp como "sticker" (512×512, estático <100KB), não como
 * imagem comum — então um .webp qualquer é enviado como documento (a Meta
 * entrega o arquivo, só não mostra preview inline de imagem).
 */

export const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
export const WEBP_MIME_TYPE = "image/webp";
export const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
]);

export const MAX_IMAGE_MB = 5; // limite oficial da Meta p/ image
export const MAX_DOCUMENT_MB = 16; // Meta permite até 100MB; 16MB já cobre catálogos/orçamentos

export type AttachmentKind = "image" | "document";

export function classifyAttachment(
  mimeType: string,
): { kind: AttachmentKind; maxBytes: number } | null {
  if (IMAGE_MIME_TYPES.has(mimeType)) {
    return { kind: "image", maxBytes: MAX_IMAGE_MB * 1024 * 1024 };
  }
  if (mimeType === WEBP_MIME_TYPE || DOCUMENT_MIME_TYPES.has(mimeType)) {
    return { kind: "document", maxBytes: MAX_DOCUMENT_MB * 1024 * 1024 };
  }
  return null;
}
