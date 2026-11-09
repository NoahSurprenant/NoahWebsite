// /api/github: the terminal theme's GitHub numbers, collected live (see scripts/github.mjs) so
// they're never more than a few hours old, however rarely the site is deployed. Netlify's CDN
// keeps each answer for six hours, so GitHub is asked a few times a day at most. Needs
// GITHUB_TOKEN in the Netlify site's environment (a fine-grained token with no permissions);
// without it, or when GitHub fails, the terminal uses the copy saved at build time.
import { snapshot } from '../../scripts/github.mjs';

const cachedFor = (seconds: number) => ({ 'Netlify-CDN-Cache-Control': `public, s-maxage=${seconds}` });

export default async () => {
  if (!process.env.GITHUB_TOKEN) return Response.json({ error: 'not configured' }, { status: 503, headers: cachedFor(3600) });
  try {
    return Response.json(await snapshot(), {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Netlify-CDN-Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error(error);
    // Not asked again for ten minutes, however many visitors come
    return Response.json({ error: 'GitHub unavailable' }, { status: 502, headers: cachedFor(600) });
  }
};

export const config = { path: '/api/github' };
