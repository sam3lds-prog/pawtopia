/**
 * Entry: the style sheet, then the store (on a device, the native one is loaded into memory first, D38), then the app.
 * Nothing that reads the save is imported until the store is ready.
 */

import './style.css';
import { hydratePlatformKV } from './services/kv';

hydratePlatformKV()
  .catch(() => undefined)
  .then(() => import('./boot'));
