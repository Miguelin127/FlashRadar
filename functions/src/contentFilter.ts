// functions/src/contentFilter.ts
// Shared content filter — blocks adult/explicit products at ingestion.
// Uses word-boundary matching to avoid false positives (e.g. "analyze").

const BLOCKED_TERMS: string[] = [
  "anal plug", "butt plug", "buttplug", "dildo", "vibrator",
  "cock ring", "cockring", "masturbat", "sex toy", "sextoy",
  "fleshlight", "bdsm", "nipple clamp", "strap-on dildo",
  "crotchless", "anal beads", "anal toy", "g-spot", "gag ball",
  "ball gag", "adult toy", "sexual wellness", "penis ring",
  "clitoral", "prostate massager",
];

// Build word-boundary regexes once
const PATTERNS = BLOCKED_TERMS.map(
  (t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
);

export function isBlockedContent(title?: string | null): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  return PATTERNS.some((re) => re.test(t));
}
