import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultSave, normalizeSave } from '../../src/services/storage';

const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('mistake feedback stays facial-only and fade-only', () => {
  it('the strike over a mistake ghost only fades; it never moves or scales', () => {
    const css = strip(readFileSync('src/ui/styles/board.css', 'utf8'));
    const rule = css.match(/\.cell__strike\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toMatch(/animation:\s*ghost\b/);
    expect(rule).not.toMatch(/transform|scale|translate/);
    expect(rule).toMatch(/pointer-events:\s*none/);
  });
});

describe('remembered pet tool', () => {
  it('defaults to Cat and survives a save round trip', () => {
    const s = defaultSave();
    expect(s.settings.lastSpecies).toBe('cat');
    s.settings.lastSpecies = 'dog';
    expect(normalizeSave(JSON.parse(JSON.stringify(s))).settings.lastSpecies).toBe('dog');
  });

  it('falls back to Cat for anything that is not a pet (older saves, tampering)', () => {
    const s = JSON.parse(JSON.stringify(defaultSave()));
    s.settings.lastSpecies = 'erase';
    expect(normalizeSave(s).settings.lastSpecies).toBe('cat');
    delete s.settings.lastSpecies;
    expect(normalizeSave(s).settings.lastSpecies).toBe('cat');
  });
});
