import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/app.css';
import './styles/mount.css';
import { useProject, seedHistory } from './state/store';
import { loadDraft } from './state/persistence';
import { migrate } from './state/migrate';
import { toast } from './state/toastStore';
import { registerDefaultPhotos } from './media/defaultPhotos';

/**
 * Bring back the draft the app has been autosaving. Nothing read it before, so a
 * refresh threw the whole session away.
 *
 * Uploaded media cannot come back: it lives behind object URLs that die with the tab.
 * Those entries are dropped rather than left as blank ghosts. Stock-library items
 * (which are just paths) are kept.
 */
function restoreDraft(): void {
  const raw = loadDraft();
  if (!raw) return;

  const state = migrate(raw);
  const kept = state.media.images.filter(m => !!m.libraryPath);
  const dropped = state.media.images.length - kept.length;

  useProject.setState({
    state: { ...state, media: { ...state.media, images: kept } },
    rev: useProject.getState().rev + 1,
    dirty: true,
  });

  if (dropped > 0) {
    setTimeout(() => toast('Restored your last session. Please re-add your images.', 'info', 4200), 400);
  }
}

restoreDraft();
seedHistory();

// Register default photos from the reference site
registerDefaultPhotos();

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
