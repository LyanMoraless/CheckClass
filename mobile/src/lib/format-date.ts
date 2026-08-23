// Manual formatting rather than toLocaleDateString(..., options) — avoids depending on full
// ICU data being present in the Hermes build on every target device/emulator.
export function formatDateTime(isoValue: string): string {
  const date = new Date(isoValue);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()} ${hours}:${minutes}`;
}
