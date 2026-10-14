/** The site's looks. The first one is the default. */
export const THEMES = [
  { id: 'skyrim', label: 'Skyrim', themeColor: '#000000' },
  { id: 'terminal', label: 'Terminal', themeColor: '#0a0f0a' },
  { id: 'xbox', label: 'Xbox', themeColor: '#061a04' },
  { id: 'mecha', label: 'Neon Genesis', themeColor: '#000000' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME: ThemeId = THEMES[0].id;

// Other spellings people might type in ?theme=
const ALIASES = new Map<string, ThemeId>([
  ['eva', 'mecha'],
  ['anime', 'mecha'],
  ['neon-genesis', 'mecha'],
  ['term', 'terminal'],
  ['shell', 'terminal'],
  ['console', 'terminal'],
  ['og-xbox', 'xbox'],
  ['dashboard', 'xbox'],
]);

/** The theme a ?theme= value or a stored choice names, or undefined if it names none. */
export function parseTheme(value: string | null | undefined): ThemeId | undefined {
  if (!value) return undefined;
  const key = value.trim().toLowerCase();
  return THEMES.find(t => t.id === key)?.id ?? ALIASES.get(key);
}
