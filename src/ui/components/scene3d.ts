/**
 * Puts the 3D toys over a sanctuary scene (D34). The 3D code (three.js) loads only when a sanctuary is first opened;
 * until it arrives, and on devices without WebGL or with "3D animals" turned off, the drawn animals stay.
 */

import { app } from '../../app/app';
import type { SceneStage } from '../../three/stage';

export interface Scene3D {
  /** Binds to the (re-)rendered scene figure and its SVG. */
  attach(figure: HTMLElement | null, svg: SVGSVGElement | null): void;
  /** Settles true once the toys are showing, false if they won't (no WebGL, setting off, load failed). */
  readonly ready: Promise<boolean>;
  setLive(on: boolean): void;
  dispose(): void;
}

let webgl: boolean | null = null;
/** Whether this device can draw WebGL (checked once). */
export function hasWebGL(): boolean {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    webgl = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl = false;
  }
  return webgl;
}

export function wants3D(): boolean {
  return app.settings.toys3d && hasWebGL();
}

let loading: Promise<typeof import('../../three/stage')> | null = null;

export function createScene3D(): Scene3D {
  let stage: SceneStage | null = null;
  let target: [HTMLElement, SVGSVGElement] | null = null;
  let live = !document.hidden;
  let disposed = false;
  let settle: (ok: boolean) => void = () => {};
  const ready = new Promise<boolean>((r) => (settle = r));
  if (wants3D()) {
    loading ??= import('../../three/stage');
    loading
      .then((m) => {
        if (disposed) return settle(false);
        stage = new m.SceneStage({ reducedMotion: () => app.reducedMotion });
        if (import.meta.env.DEV) (window as unknown as { __stage3d?: SceneStage }).__stage3d = stage;
        stage.setLive(live);
        if (target) {
          stage.attach(...target);
          settle(true);
        }
      })
      .catch(() => settle(false));
  } else settle(false);
  return {
    ready,
    attach(figure, svg) {
      target = figure && svg ? [figure, svg] : null;
      if (stage && target) {
        stage.attach(...target);
        settle(true);
      }
    },
    setLive(on) {
      live = on;
      stage?.setLive(on);
    },
    dispose() {
      disposed = true;
      settle(false);
      stage?.dispose();
      stage = null;
    },
  };
}
