import { useRegisterSW } from 'virtual:pwa-register/react';
import { usePathname } from './lib/router';
import { normalizeSlug } from './lib/slug';
import { HomePage } from './pages/HomePage';
import { EditorPage } from './pages/EditorPage';

export function App() {
  const pathname = usePathname();
  const slug = normalizeSlug(pathname);

  return (
    <>
      {slug ? <EditorPage key={slug} slug={slug} /> : <HomePage />}
      <UpdatePrompt />
    </>
  );
}

/** Announces a new cached version instead of reloading while the user is typing. */
function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="toast" role="status">
      <span>A new version is available.</span>
      <button className="btn btn-primary" onClick={() => updateServiceWorker(true)}>
        Update
      </button>
      <button className="btn" onClick={() => setNeedRefresh(false)}>
        Later
      </button>
    </div>
  );
}
