import { useProject } from '../../state/store';
import type { Aspect } from '../../state/types';

/** Every frame shape the canvas can take. */
export const ASPECTS: Aspect[] = [
  '16:9',
  '9:16',
  '1:1',
  '4:5',
  '5:4',
  '4:3',
  '3:4',
  '21:9',
  '2:3',
];

export function AspectSelect() {
  const aspect = useProject(s => s.state.frame.aspect);

  return (
    <select
      title="Frame size"
      aria-label="Frame size"
      value={aspect}
      onChange={e => {
        useProject.getState().set('frame.aspect', e.target.value as Aspect);
        useProject.getState().commit();
      }}
    >
      {ASPECTS.map(a => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
    </select>
  );
}
