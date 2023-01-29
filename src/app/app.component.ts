import { Component } from '@angular/core';
import { AnimationProp } from '@fortawesome/angular-fontawesome';
import { faGithub, faLinkedin } from '@fortawesome/free-brands-svg-icons';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'NoahWebsite';
  faGithub = faGithub;
  faLinkedin = faLinkedin;
  faEnvelope = faEnvelope;

  public githubAnim?: AnimationProp = undefined;
  public linkedinAnim?: AnimationProp = undefined;
  public envelopeAnim?: AnimationProp = undefined;
}
