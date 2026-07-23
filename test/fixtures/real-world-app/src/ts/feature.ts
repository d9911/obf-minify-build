export function activateFeature(target: HTMLElement): void {
  target.textContent = 'Dynamic feature loaded';
  target.dataset.loaded = 'true';
}
