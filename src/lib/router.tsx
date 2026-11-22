import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

const NAV_EVENT = 'localpad:navigate';

/** Deploy prefix without trailing slash: "" at the domain root, "/localpad" on a GitHub Pages project site. */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** App path (always starts with "/") -> real URL, including the deploy prefix. */
export function toUrl(appPath: string): string {
  return BASE + appPath;
}

function currentAppPath(): string {
  const { pathname } = window.location;
  if (BASE && (pathname === BASE || pathname.startsWith(BASE + '/'))) {
    return pathname.slice(BASE.length) || '/';
  }
  return pathname;
}

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(NAV_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(NAV_EVENT, onChange);
  };
}

/** Current path relative to the app ("/meeting"), regardless of the deploy prefix. */
export function usePathname(): string {
  return useSyncExternalStore(subscribe, currentAppPath);
}

export function navigate(appPath: string, { replace = false } = {}) {
  const url = toUrl(appPath);
  if (url === window.location.pathname) return;
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
  window.dispatchEvent(new Event(NAV_EVENT));
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string };

/** <a> that navigates via the History API without reloading, but respects Ctrl/Cmd+click and middle click. */
export function Link({ to, onClick, ...rest }: LinkProps) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={toUrl(to)} onClick={handle} {...rest} />;
}
