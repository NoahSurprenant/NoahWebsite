import { DOCUMENT, effect, inject, Injectable, signal } from '@angular/core';
import { DEFAULT_THEME, parseTheme, ThemeId, THEMES } from './themes';

export const THEME_PARAM = 'theme';
const STORAGE_KEY = 'theme';

/**
 * The current theme. A ?theme= link wins (so a shared link always shows what was sent), then the
 * visitor's last pick from the cog, then the default.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView!;

  readonly theme = signal<ThemeId>(
    parseTheme(new URLSearchParams(this.window.location.search).get(THEME_PARAM)) ??
    parseTheme(this.readStored()) ??
    DEFAULT_THEME,
  );

  constructor() {
    // Global styles (the cog, the page background) key off <html data-theme>
    effect(() => {
      const theme = THEMES.find(t => t.id === this.theme())!;
      this.document.documentElement.dataset['theme'] = theme.id;
      this.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.themeColor);
    });
  }

  /**
   * Switches theme, remembers it, and puts it in the address bar so the URL can be copied and sent.
   * The default theme drops the parameter instead, leaving the plain URL.
   */
  select(id: ThemeId) {
    this.theme.set(id);
    try {
      this.window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Storage is off (some private modes); the choice just isn't remembered
    }
    const url = new URL(this.window.location.href);
    if (id === DEFAULT_THEME) {
      url.searchParams.delete(THEME_PARAM);
    } else {
      url.searchParams.set(THEME_PARAM, id);
    }
    this.window.history.replaceState(this.window.history.state, '', url);
  }

  private readStored() {
    try {
      return this.window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
