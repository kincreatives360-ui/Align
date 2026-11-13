import { useProject } from '../../state/store';
import { useModal } from '../../state/modalStore';
import { toast } from '../../state/toastStore';
import { SaveIcon } from '../icons/SaveIcon';
import { Section } from '../controls/Section';
import { Toggle } from '../controls/Toggle';
import { BASE_STYLE } from '../../state/defaults';

const FILE_ID = 'fileProj';

/**
 * File-level actions: save to disk, open a saved project, start a new one.
 * The hidden `<input type="file">` lives in the app shell.
 */
export function ProjectPanel() {
  const name = useProject(s => s.state.name);
  const keepStyle = useProject(s => s.state.keepStyle);

  const save = () => {
    const state = useProject.getState().state;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(state.name || 'project').replace(/[^\w-]+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Project saved');
  };

  const open = () => document.getElementById(FILE_ID)?.click();

  const startNew = () =>
    useModal.getState().askConfirm({
      title: 'Start a new project?',
      body: 'Your current work is replaced. Save it first if you want to keep it.',
      confirmLabel: 'New project',
      onConfirm: () => {
        useProject.getState().reset();
        toast('New project');
      },
    });

  return (
    <>
      <Section id="p-file" title="Project" flat>
        <div className="row">
          <label>Name</label>
          <div className="ctl">
            <input
              className="txt"
              aria-label="Project name"
              value={name}
              onChange={e => useProject.getState().set('name', e.target.value)}
              onBlur={() => useProject.getState().commit()}
            />
          </div>
        </div>

        <button type="button" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={save}>
          <SaveIcon /> Save to file
        </button>
        <button type="button" className="ib" style={{ width: '100%' }} onClick={open}>
          Open project…
        </button>
        <button type="button" className="ib ghost" style={{ width: '100%' }} onClick={startNew}>
          New project
        </button>
      </Section>

      <Section id="p-options" title="Options" flat>
        <Toggle
          def={{
            type: 'toggle',
            path: 'keepStyle',
            label: 'Keep my look',
            def: false,
          }}
          value={keepStyle}
          onChange={next => useProject.getState().set('keepStyle', next)}
          onCommit={() => useProject.getState().commit()}
        />
        <p className="hint">
          When on, switching templates keeps your colours and effects instead of
          taking the template's own look.
        </p>
      </Section>

      <Section id="p-look" title="Appearance" flat>
        <button
          type="button"
          className="ib"
          style={{ width: '100%' }}
          onClick={() => {
            useProject.getState().mutate(s => ({ ...s, style: structuredClone(BASE_STYLE) }));
            useProject.getState().commit();
            toast('Look reset');
          }}
        >
          Reset the whole look
        </button>
      </Section>
    </>
  );
}
