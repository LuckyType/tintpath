import { writable } from 'svelte/store';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

export const toasts = writable<Toast[]>([]);

let counter = 0;

export function toast(kind: Toast['kind'], message: string, timeoutMs = 5000): void {
  const id = ++counter;
  toasts.update((list) => [...list, { id, kind, message }]);
  setTimeout(() => dismissToast(id), timeoutMs);
}

export function dismissToast(id: number): void {
  toasts.update((list) => list.filter((t) => t.id !== id));
}
