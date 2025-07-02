import { ChangeDetectionStrategy, Component, computed, OnDestroy, OnInit, signal } from '@angular/core';
import { AnimationProp } from '@fortawesome/angular-fontawesome';
import { faGithub, faLinkedin } from '@fortawesome/free-brands-svg-icons';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Noah Surprenant';
  faGithub = faGithub;
  faLinkedin = faLinkedin;
  faEnvelope = faEnvelope;

  public githubAnim?: AnimationProp = undefined;
  public linkedinAnim?: AnimationProp = undefined;
  public envelopeAnim?: AnimationProp = undefined;

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
