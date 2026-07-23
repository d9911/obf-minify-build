import { loadState, saveState, type AppState } from './store.js';

const count = document.querySelector<HTMLOutputElement>('[data-testid="count"]')!;
const increment = document.querySelector<HTMLButtonElement>('[data-testid="increment"]')!;
const form = document.querySelector<HTMLFormElement>('[data-testid="profile-form"]')!;
const name = document.querySelector<HTMLInputElement>('[data-testid="name"]')!;
const savedName = document.querySelector<HTMLElement>('[data-testid="saved-name"]')!;
const tasks = document.querySelector<HTMLUListElement>('[data-testid="tasks"]')!;
const feature = document.querySelector<HTMLElement>('[data-testid="feature"]')!;
const state: AppState = loadState();

function render(): void {
  count.value = String(state.count);
  count.textContent = String(state.count);
  savedName.textContent = state.name;
}

increment.addEventListener('click', () => {
  state.count += 1;
  saveState(state);
  render();
});

form.addEventListener('submit', event => {
  event.preventDefault();
  state.name = name.value.trim();
  saveState(state);
  render();
});

const response = await fetch('./data/tasks.json');
if (!response.ok) throw new Error(`Tasks request failed: ${response.status}`);
const values = await response.json() as Array<{ title: string }>;
for (const value of values) {
  const item = document.createElement('li');
  item.textContent = value.title;
  tasks.append(item);
}

const { activateFeature } = await import('./feature.js');
activateFeature(feature);
render();
