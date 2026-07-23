export interface AppState {
  count: number;
  name: string;
}

const key = 'obf-minify-build-e2e';

export function loadState(): AppState {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) as AppState : { count: 0, name: '' };
}

export function saveState(state: AppState): void {
  localStorage.setItem(key, JSON.stringify(state));
}
