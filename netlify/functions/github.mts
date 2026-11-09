// /api/github: the terminal theme's GitHub numbers, collected live (see scripts/github.mjs) so
// they're current however rarely the site is deployed. Netlify's CDN keeps each answer for six
// hours, so GitHub is asked a few times a day at most. Needs GITHUB_TOKEN in the Netlify site's
// environment (a fine-grained token with no permissions).
//
// Every good answer is also saved to Netlify Blobs. When GitHub fails (its contribution graph
// sometimes answers 504), the last good answer is served instead, with when it was collected.
import { getStore } from '@netlify/blobs';
import { snapshot } from '../../scripts/github.mjs';

const KEY = 'latest';

export default async () => {
  const store = getStore('github');
  try {
    const data = { ...(await snapshot()), collected: new Date().toISOString() };
    // Not saving it is no reason not to serve it
    await store.setJSON(KEY, data).catch(error => console.error('Saving the answer failed', error));
    return Response.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Netlify-CDN-Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error(error);
    const saved = await store.get(KEY, { type: 'json' });
    // Asked again after ten minutes, however many visitors come meanwhile
    const retry = { 'Netlify-CDN-Cache-Control': 'public, s-maxage=600' };
    if (saved) return Response.json(saved, { headers: retry });
    return Response.json({ error: 'GitHub unavailable' }, { status: 502, headers: retry });
  }
};

export const config = { path: '/api/github' };
