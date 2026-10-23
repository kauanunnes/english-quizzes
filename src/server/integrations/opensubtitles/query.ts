// server/integrations/opensubtitles/query.ts
const DEFAULTS: Record<string, string> = {
  ai_translated: 'include',
  machine_translated: 'exclude',
  hearing_impaired: 'include',
};

const stripImdb = (v: string) => v.replace(/^tt/, '').replace(/^0+/, '');
const stripZeros = (v: string) => (/^\d+$/.test(v) ? String(Number(v)) : v);

export function buildSubtitleQuery(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => {
      const key = k.toLowerCase();
      const raw = String(v).trim().toLowerCase();
      const value = key.endsWith('imdb_id')
        ? stripImdb(raw)
        : key.endsWith('_id')
        ? stripZeros(raw)
        : raw;
      return [key, value] as const;
    })
    .filter(([k, v]) => DEFAULTS[k] !== v)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`)
    .join('&');
}
