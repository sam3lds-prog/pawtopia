/**
 * Haptics adapter. On iOS/Android (Capacitor native) uses @capacitor/haptics; in a browser falls back to
 * navigator.vibrate where it exists (iOS Safari has none, so it is silently skipped). Every call is guarded.
 */

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export type HapticKind = 'tap' | 'place' | 'error' | 'success' | 'select';

let enabled = true;
export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

export function haptic(kind: HapticKind): void {
  if (!enabled) return;
  try {
    if (Capacitor.isNativePlatform()) {
      if (kind === 'error') void Haptics.notification({ type: NotificationType.Warning });
      else if (kind === 'success') void Haptics.notification({ type: NotificationType.Success });
      else if (kind === 'select') void Haptics.selectionChanged();
      else void Haptics.impact({ style: kind === 'place' ? ImpactStyle.Medium : ImpactStyle.Light });
      return;
    }
    const pattern = kind === 'error' ? [24, 40, 24] : kind === 'success' ? [12, 30, 12, 30, 24] : kind === 'place' ? 14 : 8;
    navigator.vibrate?.(pattern);
  } catch {
    /* no haptics on this device */
  }
}
