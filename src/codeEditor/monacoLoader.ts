import loader from '@monaco-editor/loader';

let monacoPromise: Promise<any> | null = null;

/**
 * Lazy-load Monaco via CDN (P0 spike — no bundler/worker changes).
 * Resolves with the `monaco` namespace. Configure a custom `vs` base
 * URL (e.g. pinned version or self-hosted mirror) via `cdnUrl`.
 */
export function loadMonaco(cdnUrl?: string): Promise<any> {
  if (cdnUrl) {
    loader.config({ paths: { vs: cdnUrl } });
  }
  if (!monacoPromise) {
    monacoPromise = loader.init();
  }
  return monacoPromise;
}

/** Test-only: reset the cached promise between test cases. */
export function resetMonacoLoaderCache() {
  monacoPromise = null;
}
