import { useProject } from '../../state/store';
import { SunIcon } from '../icons/SunIcon';
import { MoonIcon } from '../icons/MoonIcon';

/** Light / dark switch. The choice lives in the project so it round-trips. */
export function ThemeToggle() {
  const theme = useProject(s => s.state.theme);
  const pick = (next: 'light' | 'dark') => {
    useProject.getState().set('theme', next);
    useProject.getState().commit();
  };

  return (
    <div className="seg2" id="theme" role="group" aria-label="Theme">
      <button
        data-v="light"
        title="Light theme"
        aria-label="Light theme"
        className={theme === 'light' ? 'on' : ''}
        onClick={() => pick('light')}
      >
        <SunIcon />
      </button>
      <button
        data-v="dark"
        title="Dark theme"
        aria-label="Dark theme"
        className={theme === 'dark' ? 'on' : ''}
        onClick={() => pick('dark')}
      >
        <MoonIcon />
      </button>
    </div>
  );
}
