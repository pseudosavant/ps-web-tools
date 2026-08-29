export const LARGE_FILE_WARNING_BYTES = 5 * 1024 * 1024;
export const TEXT_PREVIEW_LIMIT_BYTES = 512 * 1024;

const PREVIEWABLE_IMAGES = new Set([
  "image/apng",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const PREVIEWABLE_AUDIO = new Set([
  "audio/aac",
  "audio/flac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-wav"
]);

const PREVIEWABLE_VIDEO = new Set([
  "video/mp4",
  "video/ogg",
  "video/quicktime",
  "video/webm"
]);

export function createRevisionTracker(initialRevision = 0) {
  let revision = Number.isInteger(initialRevision) ? initialRevision : 0;

  return Object.freeze({
    current() {
      return revision;
    },
    isCurrent(candidate) {
      return candidate === revision;
    },
    next() {
      revision += 1;
      return revision;
    }
  });
}

export function normalizeMimeType(type) {
  return String(type || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
}

export function getPreviewKind(type) {
  const normalized = normalizeMimeType(type);
  if (PREVIEWABLE_IMAGES.has(normalized)) return "image";
  if (PREVIEWABLE_AUDIO.has(normalized)) return "audio";
  if (PREVIEWABLE_VIDEO.has(normalized)) return "video";

  if (
    normalized.startsWith("text/") ||
    normalized === "application/json" ||
    normalized === "application/ld+json" ||
    normalized === "application/xml" ||
    normalized === "application/javascript" ||
    normalized === "application/x-javascript" ||
    normalized === "image/svg+xml" ||
    normalized.endsWith("+json") ||
    normalized.endsWith("+xml")
  ) {
    return "text";
  }

  return "unsupported";
}

export function textToDataURI(text, type = "text/plain") {
  const bytes = new TextEncoder().encode(String(text));
  const base64 = bytesToBase64(bytes);
  return {
    uri: `data:${type};charset=utf-8;base64,${base64}`,
    size: bytes.length
  };
}

export function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

export function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = Number(bytes) || 0;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 10 || unit === "B" ? 0 : 1)} ${unit}`;
}
