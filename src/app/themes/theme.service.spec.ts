import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

function serviceAt(url: string) {
  window.history.replaceState(null, '', url);
  return TestBed.inject(ThemeService);
}

describe('ThemeService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('defaults to Skyrim', () => {
    expect(serviceAt('/').theme()).toBe('skyrim');
  });

  it('takes the theme from ?theme=', () => {
    expect(serviceAt('/?theme=xbox').theme()).toBe('xbox');
  });

  it('ignores an unknown ?theme=', () => {
    expect(serviceAt('/?theme=nope').theme()).toBe('skyrim');
  });

  it('falls back to the last theme picked', () => {
    localStorage.setItem('theme', 'mecha');
    expect(serviceAt('/').theme()).toBe('mecha');
  });

  it('prefers the link over the last pick', () => {
    localStorage.setItem('theme', 'mecha');
    expect(serviceAt('/?theme=terminal').theme()).toBe('terminal');
  });

  it('remembers a pick and puts it in the URL, keeping other parameters', () => {
    const service = serviceAt('/?ref=x');
    service.select('terminal');
    expect(service.theme()).toBe('terminal');
    expect(localStorage.getItem('theme')).toBe('terminal');
    expect(window.location.search).toBe('?ref=x&theme=terminal');
  });

  it('drops the parameter when the default is picked', () => {
    const service = serviceAt('/?theme=xbox');
    service.select('skyrim');
    expect(window.location.search).toBe('');
    expect(localStorage.getItem('theme')).toBe('skyrim');
  });

  it('marks <html> with the theme for the global styles', () => {
    const service = serviceAt('/?theme=mecha');
    TestBed.tick();
    expect(document.documentElement.dataset['theme']).toBe('mecha');
    service.select('xbox');
    TestBed.tick();
    expect(document.documentElement.dataset['theme']).toBe('xbox');
  });
});

describe('ThemeService without storage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('still works when storage is off, it just forgets', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    const service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe('skyrim');
    service.select('xbox');
    expect(service.theme()).toBe('xbox');
    expect(window.location.search).toBe('?theme=xbox');
  });
});
