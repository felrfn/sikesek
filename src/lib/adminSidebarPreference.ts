/**
 * Persisted state for the collapsible admin sidebar. Shared between the
 * server layout (reads it to render the right width on first paint, so the
 * sidebar never flashes open before collapsing) and the client toggle
 * (writes it with `document.cookie` for an instant, round-trip-free toggle).
 */
export const SIDEBAR_COOKIE = "admin_sidebar";

export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Only "collapsed" collapses the rail; anything else (or no cookie) is open. */
export function isSidebarCollapsed(value: string | undefined) {
  return value === "collapsed";
}
