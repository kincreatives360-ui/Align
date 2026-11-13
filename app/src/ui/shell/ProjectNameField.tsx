import { useProject } from '../../state/store';

/**
 * The project title in the header. Typing updates state continuously but
 * only commits on blur or Enter, so one rename is one undo step.
 */
export function ProjectNameField() {
  const name = useProject(s => s.state.name);

  return (
    <input
      aria-label="Project name"
      value={name}
      placeholder="Untitled project"
      onChange={e => useProject.getState().set('name', e.target.value)}
      onBlur={e => {
        if (!e.target.value.trim()) useProject.getState().set('name', 'Untitled project');
        useProject.getState().commit();
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}
