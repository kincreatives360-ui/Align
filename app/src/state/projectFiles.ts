import { useProject } from './store';
import { migrate } from './migrate';
import { toast } from './toastStore';
import { newProject } from './defaults';
import { register } from './mediaRegistry';

/** Parse and install a project file dropped or picked from disk. */
export function openProject(file: File): void {
  const reader = new FileReader();

  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result)) as unknown;
      const state = migrate(parsed);
      register(state.media.images);
      useProject.getState().replace(state);
      toast(`Opened ${file.name}`);
    } catch {
      toast('That file is not a valid project');
    }
  };

  reader.onerror = () => toast('Could not read the file');
  reader.readAsText(file);
}

/** Serialise the current project, ready to write to disk. */
export function projectJson(): string {
  return JSON.stringify(useProject.getState().state, null, 2);
}

/** A brand-new project, replacing whatever is open. */
export function newProjectFile(): void {
  useProject.getState().replace(newProject());
}
