/**
 * Analytics hooks. Event names follow the product spec. No PII is ever attached: properties are limited to
 * game facts (mode, size, seconds, counts). Events go to pluggable sinks; by default they stay in a small
 * in-memory ring buffer (and the dev console). A real provider is added by registering a sink.
 */

export type AnalyticsEvent =
  | 'app_open'
  | 'onboarding_step'
  | 'puzzle_start'
  | 'puzzle_complete'
  | 'puzzle_fail'
  | 'hint_used'
  | 'pet_unlocked'
  | 'decor_bought'
  | 'sanctuary_open'
  | 'daily_complete'
  | 'league_open'
  | 'rewarded_ad_offer'
  | 'rewarded_ad_complete'
  | 'iap_started'
  | 'iap_success'
  | 'iap_failed'
  | 'screen_view'
  | 'animation_reduced_mode'
  | 'mission_claimed'
  | 'achievement_unlocked'
  | 'extra_life_used'
  | 'companion_unlocked';

export type EventProps = Record<string, string | number | boolean>;

export interface AnalyticsSink {
  send(name: AnalyticsEvent, props: EventProps, at: number): void;
}

const MAX_BUFFER = 200;
const buffer: Array<{ name: AnalyticsEvent; props: EventProps; at: number }> = [];
const sinks = new Set<AnalyticsSink>();
let enabled = true;

/** Keys that must never leave the device even if a caller passes them by mistake. */
const BLOCKED = /name|email|phone|address|token|id_?fa|device/i;

export function addSink(s: AnalyticsSink): () => void {
  sinks.add(s);
  return () => sinks.delete(s);
}

export function setAnalyticsEnabled(on: boolean): void {
  enabled = on;
}

export function track(name: AnalyticsEvent, props: EventProps = {}): void {
  if (!enabled) return;
  const clean: EventProps = {};
  for (const [k, v] of Object.entries(props)) if (!BLOCKED.test(k)) clean[k] = v;
  const at = Date.now();
  buffer.push({ name, props: clean, at });
  if (buffer.length > MAX_BUFFER) buffer.shift();
  for (const s of sinks) {
    try {
      s.send(name, clean, at);
    } catch {
      /* a sink failing must never break the game */
    }
  }
}

export function recentEvents(): ReadonlyArray<{ name: AnalyticsEvent; props: EventProps; at: number }> {
  return buffer;
}
