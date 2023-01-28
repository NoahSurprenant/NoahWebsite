import { Component } from '@angular/core';
import { AnimationProp } from '@fortawesome/angular-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { faLinkedin } from '@fortawesome/free-brands-svg-icons'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'NoahWebsite';
  faGithub = faGithub;
  faLinkedin = faLinkedin;

  public githubAnim?: AnimationProp = undefined;
  public linkedinAnim?: AnimationProp = undefined;
}
