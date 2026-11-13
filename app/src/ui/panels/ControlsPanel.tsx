import { useProject } from '../../state/store';
import { byId } from '../../templates/registry';
import { controlGroups } from '../../templates/params';
import { Section } from '../controls/Section';
import { ControlRenderer } from '../controls/ControlRenderer';
import { getPath } from '../../state/path';
import { setPath } from '../../state/path';

/** The active template's own settings, grouped under collapsible headings. */
export function ControlsPanel() {
  const templateId = useProject(s => s.state.templateId);
  const state = useProject(s => s.state);
  const template = byId(templateId);
  const groups = controlGroups(template);

  const resetGroup = (sectionId: string) => {
    const keys = new Set<string>();
    for (const control of groups.find(g => g.id === sectionId)?.controls ?? []) {
      if (control.type === 'header') continue;
      keys.add(control.path);
    }
    useProject.getState().mutate(s => {
      let next = s;
      for (const path of keys) {
        const control = groups
          .find(g => g.id === sectionId)
          ?.controls.find(c => c.type !== 'header' && c.path === path);
        if (control && control.type !== 'header') next = setPath(next, path, control.def);
      }
      return next;
    });
    useProject.getState().commit();
  };

  return (
    <>
      <p className="hint" style={{ padding: '0 2px' }}>
        {template.name}
        {template.desc ? ` — ${template.desc}` : ''}
      </p>

      {groups.map(group => (
        <Section
          key={group.id}
          id={group.id}
          title={group.title}
          subtitle={group.subtitle}
          flat
          modified={group.controls.some(
            c => c.type !== 'header' && getPath(state, c.path) !== c.def,
          )}
          onReset={() => resetGroup(group.id)}
        >
          {group.controls.map((control, i) => (
            <ControlRenderer key={`${group.id}-${i}`} def={control} />
          ))}
        </Section>
      ))}
    </>
  );
}
