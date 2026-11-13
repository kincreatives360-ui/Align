import { useProject } from '../../state/store';
import { useModal } from '../../state/modalStore';
import { toast } from '../../state/toastStore';
import { SaveIcon } from '../icons/SaveIcon';
import { Section } from '../controls/Section';
import { Toggle } from '../controls/Toggle';
import { BASE_STYLE } from '../../state/defaults';
import { getAllProjects, putProject, deleteProject } from '../../media/store';
import { useState, useEffect } from 'react';

const FILE_ID = 'fileProj';

/**
 * File-level actions: save to disk, open a saved project, start a new one.
 * The hidden `<input type="file">` lives in the app shell.
 */
export function ProjectPanel() {
  const name = useProject(s => s.state.name);
  const keepStyle = useProject(s => s.state.keepStyle);
  const [projects, setProjects] = useState<any[]>([]);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const list = await getAllProjects();
      setProjects(list.filter(p => p.id !== 'current').sort((a, b) => b.updatedAt - a.updatedAt));
    } catch {
      /* ignore */
    }
  }

  const save = async () => {
    const state = useProject.getState().state;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(state.name || 'project').replace(/[^\w-]+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Project saved to file');
  };

  const saveAs = async () => {
    const newName = prompt('Save as:', name);
    if (!newName || newName === name) return;
    const state = useProject.getState().state;
    const newState = { ...state, name: newName };
    useProject.getState().replace(newState);
    await save();
    toast(`Saved as ${newName}`);
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

  const openProjectFromList = async (projectData: string) => {
    try {
      const parsed = JSON.parse(projectData);
      const { migrate } = await import('../../state/migrate');
      const state = migrate(parsed);
      useProject.getState().replace(state);
      toast(`Opened ${state.name}`);
    } catch {
      toast('Could not open project');
    }
  };

  const renameProject = async (project: any) => {
    const newName = prompt('Rename project:', project.name);
    if (!newName || newName === project.name) return;
    project.name = newName;
    project.updatedAt = Date.now();
    project.data = JSON.stringify({ ...JSON.parse(project.data), name: newName });
    await putProject(project);
    await loadProjects();
    toast('Renamed');
  };

  const duplicateProject = async (project: any) => {
    const newProject = { ...project, id: `proj-${Date.now()}`, name: `${project.name} copy`, updatedAt: Date.now() };
    await putProject(newProject);
    await loadProjects();
    toast('Duplicated');
  };

  const deleteProjectItem = async (project: any) => {
    if (!confirm(`Delete "${project.name}"?`)) return;
    await deleteProject(project.id);
    await loadProjects();
    toast('Deleted');
  };

  const exportProjectWithMedia = async () => {
    const state = useProject.getState().state;
    // Inline media as base64 for portability
    const mediaItems = state.media.images;
    const inlined: any[] = [];
    for (const item of mediaItems) {
      if (item.libraryPath) {
        // Stock library item - keep path
        inlined.push(item);
      } else {
        // Local file - would need to fetch from IndexedDB
        // For now, just include the item metadata
        inlined.push(item);
      }
    }
    const exportState = { ...state, media: { ...state.media, images: inlined } };
    const blob = new Blob([JSON.stringify(exportState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(state.name || 'project').replace(/[^\w-]+/g, '-')}-full.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Project with media saved');
  };

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
        <button type="button" className="ib" style={{ width: '100%' }} onClick={saveAs}>
          Save as…
        </button>
        <button type="button" className="ib" style={{ width: '100%' }} onClick={exportProjectWithMedia}>
          Export with media…
        </button>
        <button type="button" className="ib" style={{ width: '100%' }} onClick={open}>
          Open project…
        </button>
        <button type="button" className="ib ghost" style={{ width: '100%' }} onClick={startNew}>
          New project
        </button>
      </Section>

      <Section id="p-saved" title="Saved Projects" flat>
        <button
          type="button"
          className="ib"
          style={{ width: '100%', justifyContent: 'flex-start' }}
          onClick={() => setShowList(!showList)}
        >
          {showList ? 'Hide' : 'Show'} saved projects ({projects.length})
        </button>

        {showList && projects.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {projects.map(p => (
              <div key={p.id} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: 6, border: '1px solid var(--border)', borderRadius: 4 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div className="hint" style={{ fontSize: 10 }}>
                    {new Date(p.updatedAt).toLocaleString()} · {p.data ? Math.round(p.data.length / 1024) : 0} KB
                  </div>
                </div>
                <button type="button" className="ib ghost sm" onClick={() => openProjectFromList(p.data)}>Open</button>
                <button type="button" className="ib ghost sm" onClick={() => renameProject(p)}>Rename</button>
                <button type="button" className="ib ghost sm" onClick={() => duplicateProject(p)}>Duplicate</button>
                <button type="button" className="ib ghost sm" style={{ color: 'var(--danger)' }} onClick={() => deleteProjectItem(p)}>Delete</button>
              </div>
            ))}
          </div>
        )}

        {showList && projects.length === 0 && (
          <p className="hint" style={{ marginTop: 8 }}>No saved projects yet</p>
        )}
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
