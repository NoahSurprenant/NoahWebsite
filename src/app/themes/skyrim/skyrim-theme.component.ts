import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { LINKS, NAME } from '../../links';
import { SkyrimLoadingComponent } from '../../skyrim-loading/skyrim-loading.component';

@Component({
  selector: 'app-skyrim-theme',
  templateUrl: './skyrim-theme.component.html',
  styleUrls: ['./skyrim-theme.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkyrimLoadingComponent, FaIconComponent],
})
export class SkyrimThemeComponent {
  protected readonly name = NAME;
  protected readonly links = LINKS;
}
