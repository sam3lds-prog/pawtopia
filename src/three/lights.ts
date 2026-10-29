/** The light every toy is seen in (D34): a soft sky, a warm sun from the upper left, and a cool rim from behind. */

import * as THREE from 'three';

export function addLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight('#fffaf2', '#cfdcc6', 1.75));
  const sun = new THREE.DirectionalLight('#fff3e0', 1.9);
  sun.position.set(-0.7, 1, 1.1);
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#eaf4ff', 1.1);
  rim.position.set(0.9, 0.7, -1);
  scene.add(rim);
}
