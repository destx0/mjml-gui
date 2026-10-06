/**
 * Trigger a same-origin file download via a Blob URL.
 * Throws where the download API is unavailable (jsdom, blocked popups) —
 * callers that must not fail (tests, headless) should try/catch.
 */
export function downloadFile(content: string | Blob, filename: string, mime: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
