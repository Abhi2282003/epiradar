import { useSyncExternalStore } from 'react';

// Browser-only, in-memory state: pulsing municipality outlines and replay feed lines (never persisted).
export type ReplayEvent = { id: string; ts: string; message: string };
let pulsing: string[] = [];
let replayEvents: ReplayEvent[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const EMPTY: never[] = [];

export function pulseRegions(ids: string[], ms = 3000) {
  if (!ids.length) return;
  pulsing = [...new Set([...pulsing, ...ids])]; emit();
  setTimeout(() => { pulsing = pulsing.filter(id => !ids.includes(id)); emit(); }, ms);
}
export function addReplayEvents(messages: string[]) {
  if (!messages.length) return;
  const ts = new Date().toISOString();
  replayEvents = [...messages.map((message, i) => ({ id: `replay-${Date.now()}-${i}-${Math.random()}`, ts, message })).reverse(), ...replayEvents].slice(0, 50); emit();
}
export const usePulsingRegions = () => useSyncExternalStore(subscribe, () => pulsing, () => EMPTY);
export const useReplayEvents = () => useSyncExternalStore(subscribe, () => replayEvents, () => EMPTY as ReplayEvent[]);
