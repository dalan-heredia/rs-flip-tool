import type { WikiEnvelope, WikiLatestEntry, Wiki5mEntry, Wiki1hEntry, WikiMappingItem } from './types';

const BASE = 'https://prices.runescape.wiki/api/v1/osrs';

function userAgent(): string {
  // Set something identifying (Wiki guidance commonly requests a descriptive UA)
  return (
    process.env.WIKI_USER_AGENT ??
    'rs-flip-tool (github.com/dalan-heredia/rs-flip-tool)'
  );
}

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': userAgent(),
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Wiki API ${res.status} on ${path}: ${body.slice(0, 200)}`);
  }

  return (await res.json()) as T;
}

export async function fetchLatest(): Promise<WikiEnvelope<Record<string, WikiLatestEntry>>> {
  return fetchJson('/latest');
}

export async function fetch5m(): Promise<WikiEnvelope<Record<string, Wiki5mEntry>>> {
  return fetchJson('/5m');
}

export async function fetch1h(): Promise<WikiEnvelope<Record<string, Wiki1hEntry>>> {
  return fetchJson('/1h');
}

export async function fetchMapping(): Promise<WikiMappingItem[]> {
  // mapping is an array (not wrapped)
  return fetchJson('/mapping');
}
