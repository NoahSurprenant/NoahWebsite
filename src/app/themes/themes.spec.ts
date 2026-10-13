import { parseTheme, THEMES } from './themes';

describe('parseTheme', () => {
  it('accepts every theme id', () => {
    for (const theme of THEMES) {
      expect(parseTheme(theme.id)).toBe(theme.id);
    }
  });

  it('ignores case, spaces and aliases', () => {
    expect(parseTheme(' Terminal ')).toBe('terminal');
    expect(parseTheme('eva')).toBe('mecha');
    expect(parseTheme('Anime')).toBe('mecha');
    expect(parseTheme('neon-genesis')).toBe('mecha');
  });

  it('returns undefined for anything else', () => {
    expect(parseTheme(null)).toBeUndefined();
    expect(parseTheme('')).toBeUndefined();
    expect(parseTheme('vaporwave')).toBeUndefined();
    // Inherited object keys aren't aliases
    expect(parseTheme('constructor')).toBeUndefined();
  });
});
