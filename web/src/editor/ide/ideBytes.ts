/** The IDE download size in gzip bytes, built in by vite.config.ts from ide-manifest.json; null if it was absent. */
export function ideDownloadBytes(): number | null {
  return __IDE_BYTES__
}
