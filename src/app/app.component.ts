import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ThemeSwitcherComponent } from './theme-switcher/theme-switcher.component';
import { SkyrimThemeComponent } from './themes/skyrim/skyrim-theme.component';
import { TerminalThemeComponent } from './themes/terminal/terminal-theme.component';
import { MechaThemeComponent } from './themes/mecha/mecha-theme.component';
import { ThemeService } from './themes/theme.service';
import { XboxThemeComponent } from './themes/xbox/xbox-theme.component';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ThemeSwitcherComponent, SkyrimThemeComponent, TerminalThemeComponent, XboxThemeComponent, MechaThemeComponent]
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Noah Surprenant';
  protected readonly theme = inject(ThemeService).theme;

  innerWidth = signal<number>(0);
  innerHeight = signal<number>(0);
  displayWatermark = computed(() => {
    return this.innerWidth() >= 1920 && this.innerHeight() > 800;
  });

  private resizeHandler = () => {
    this.innerWidth.set(window.innerWidth);
    this.innerHeight.set(window.innerHeight);
  };

  ngOnInit() {
    window.addEventListener('resize', this.resizeHandler);
    this.resizeHandler();
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.resizeHandler);
  }
}
