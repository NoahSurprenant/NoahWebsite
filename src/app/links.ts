import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faGithub, faLinkedin } from '@fortawesome/free-brands-svg-icons';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { faFilePdf } from '@fortawesome/free-regular-svg-icons';

/** The links every theme shows, in order. */
export interface SiteLink {
  /** Accessible name, the same in every theme */
  label: string;
  /** Without the file type, for themes that spell the links out */
  short: string;
  /** One lowercase word, for the terminal's `open github` */
  id: string;
  href: string;
  icon: IconDefinition;
}

export const LINKS: readonly SiteLink[] = [
  { label: 'LinkedIn', short: 'LinkedIn', id: 'linkedin', href: 'https://www.linkedin.com/in/noahsurprenant/', icon: faLinkedin },
  { label: 'GitHub', short: 'GitHub', id: 'github', href: 'https://github.com/NoahSurprenant', icon: faGithub },
  { label: 'Email', short: 'Email', id: 'email', href: 'mailto:noah.surprenant@gmail.com', icon: faEnvelope },
  { label: 'Resume (PDF)', short: 'Resume', id: 'resume', href: 'https://cdn.noahsurprenant.com/Noah%20Surprenant%20-%20Resume.pdf', icon: faFilePdf },
];

export const NAME = 'Noah Surprenant';
