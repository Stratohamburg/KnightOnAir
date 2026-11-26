export function debugVisible(search: string, dev: boolean) {
  return dev || new URLSearchParams(search).has("debug");
}

export function referenceRequested(search: string, hash: string) {
  return new URLSearchParams(search).has("reference") || hash === "#reference";
}
