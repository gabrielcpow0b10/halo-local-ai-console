const WEB_SEARCH_PATTERNS = [
  /\btoday\b/,
  /\bnow\b/,
  /\blatest\b/,
  /\bcurrent\b/,
  /\bthis\s+week\b/,
  /\bprices?\b/,
  /\bversions?\b/,
  /\breleases?\b/,
  /\breleased\b/,
  /\bscores?\b/,
  /\bschedules?\b/,
  /\bnews\b/,
  /\blaws?\b/,
  /\bsports?\b/,
  /\blive\s+events?\b/,
  /\brecent\b/,
  /\bsearch\b/,
  /\bverify\b/,
  /\blook\s+up\b/,
];

export function shouldUseWebSearch(message: string) {
  const normalized = message.trim().toLowerCase();

  if (!normalized) return false;

  return WEB_SEARCH_PATTERNS.some((pattern) => pattern.test(normalized));
}
