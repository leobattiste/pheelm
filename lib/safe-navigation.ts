/** Accept only same-site paths, including after URL normalization and decoding. */
export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, "https://pheelm.invalid");
    const path = decodeURIComponent(url.pathname);
    if (url.origin !== "https://pheelm.invalid" || path.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(path)) return null;
    return value;
  } catch { return null; }
}
