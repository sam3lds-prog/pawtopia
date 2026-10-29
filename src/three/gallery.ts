/**
 * Dev-only gallery of every toy (open /toys.html on the dev server). Query: `?clip=backflip&t=0.5` freezes every toy at
 * that moment of a clip, `?face=love` shows an expression, `?only=mochi` one toy, `?yaw=1.2` turns them, `?cols=5`.
 */

import * as THREE from 'three';
import { Actor } from './actor';
import { addLights } from './lights';
import { ALL_TOY_IDS, toySpec } from './species';
import { Toy, ToyKit } from './toy';
import type { Expr } from './face';

const q = new URLSearchParams(location.search);
const ids = q.get('only') ? q.get('only')!.split(',') : [...ALL_TOY_IDS];
const cols = Number(q.get('cols') ?? Math.min(5, ids.length));
const rows = Math.ceil(ids.length / cols);
const W = innerWidth;
const H = Math.max(innerHeight, rows * 200);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
addLights(scene);
const D = 900;
const camera = new THREE.PerspectiveCamera((2 * Math.atan(H / 2 / D) * 180) / Math.PI, W / H, 10, 5000);
camera.position.set(0, 0, D);

const kit = new ToyKit();
const actors: Actor[] = [];
const cellW = W / cols;
const cellH = H / rows;
const labels = document.getElementById('labels')!;
ids.forEach((id, i) => {
  const spec = toySpec(id);
  if (!spec) return;
  const toy = new Toy(spec, kit, q.get('mood') ?? undefined);
  const cx = (i % cols) * cellW + cellW / 2;
  const cy = Math.floor(i / cols) * cellH + cellH * 0.82;
  const s = Math.min(cellW, cellH) * 0.62;
  toy.root.position.set(cx - W / 2, H / 2 - cy, 0);
  toy.root.scale.setScalar(s);
  toy.root.rotation.x = 0.16;
  if (q.get('yaw')) toy.root.rotation.y = Number(q.get('yaw'));
  scene.add(toy.root);
  const a = new Actor(toy, i * 7919 + 13);
  actors.push(a);
  const l = document.createElement('span');
  l.textContent = id;
  l.style.left = `${cx}px`;
  l.style.top = `${cy + 6}px`;
  labels.appendChild(l);
});

const clip = q.get('clip');
const t = q.get('t');
const face = q.get('face') as Expr | null;
const start = performance.now();
if (clip) for (const a of actors) a.perform(clip, start) || a.ambient(clip, start);

function frame(now: number): void {
  const at = clip && t !== null ? start + Number(t) * (actors[0] ? 3400 : 0) : now;
  for (const a of actors) {
    if (clip && t !== null) {
      // Freeze at t of this clip's own length.
      const ms = (a as unknown as { layers: Array<{ clip: { ms: number } }> }).layers[0]?.clip.ms ?? 1000;
      a.update(start + Number(t) * ms - 1, false);
    } else a.update(at, !q.has('still'));
    if (face) a.toy.setFace(face);
  }
  renderer.render(scene, camera);
  if (!(clip && t !== null)) requestAnimationFrame(frame);
  else (window as unknown as { __ready: boolean }).__ready = true;
}
requestAnimationFrame(frame);
(window as unknown as { __ready: boolean }).__ready = false;
setTimeout(() => ((window as unknown as { __ready: boolean }).__ready = true), 600);
