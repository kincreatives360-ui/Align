import { useProject } from '../../state/store';
import { getPath } from '../../state/path';
import type { ControlDef } from '../../state/controls';
import { Slider } from './Slider';
import { Segmented } from './Segmented';
import { Select } from './Select';
import { Toggle } from './Toggle';
import { ColorInput } from './ColorInput';
import { TextInput } from './TextInput';

interface Props {
  def: ControlDef;
}

/**
 * Schema → widget.
 *
 * This is the whole point of the control schema: one switch statement turns
 * declarative data into the right control, wired to `set` while the user
 * drags and `commit` when they let go.
 */
export function ControlRenderer({ def }: Props) {
  // Header controls have no path; compute it before the hooks so the union
  // narrows cleanly and the selectors stay unconditional.
  const path = def.type === 'header' ? '' : def.path;

  const value = useProject(s => (path ? getPath(s.state, path) : undefined));
  const visible = useProject(s => !def.showIf || def.showIf(s.state));

  if (def.type === 'header') {
    if (def.showIf && !visible) return null;
    return <div className="grp-h2">{def.label}</div>;
  }

  if (def.showIf && !visible) return null;

  const set = (next: unknown) => useProject.getState().set(def.path, next);
  const commit = () => useProject.getState().commit();

  switch (def.type) {
    case 'range':
      return (
        <Slider
          def={def}
          value={typeof value === 'number' ? value : def.def}
          onChange={set}
          onCommit={commit}
        />
      );
    case 'segment':
      return (
        <Segmented
          def={def}
          value={String(value ?? def.def)}
          onChange={set}
          onCommit={commit}
        />
      );
    case 'select':
      return (
        <Select
          def={def}
          value={String(value ?? def.def)}
          onChange={set}
          onCommit={commit}
        />
      );
    case 'toggle':
      return (
        <Toggle
          def={def}
          value={typeof value === 'boolean' ? value : def.def}
          onChange={set}
          onCommit={commit}
        />
      );
    case 'color':
      return (
        <ColorInput
          def={def}
          value={typeof value === 'string' ? value : def.def}
          onChange={set}
          onCommit={commit}
        />
      );
    case 'text':
      return (
        <TextInput
          def={def}
          value={typeof value === 'string' ? value : def.def}
          onChange={set}
          onCommit={commit}
        />
      );
  }
}
