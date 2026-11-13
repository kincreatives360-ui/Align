import { useProject } from '../../state/store';
import { getPath, setPath } from '../../state/path';
import { sectionModified } from '../../state/controls';
import { STYLE_SECTIONS } from './sections';
import { Section } from '../controls/Section';
import { ControlRenderer } from '../controls/ControlRenderer';

/**
 * The look inspector. Every section comes from `sections/`, so this
 * component never needs to change when an effect is added or renamed.
 */
export function VisualPanel() {
  const state = useProject(s => s.state);

  const resetSection = (controls: typeof STYLE_SECTIONS[number]['controls'], togglePath?: string) => {
    useProject.getState().mutate(s => {
      let next = s;
      for (const control of controls) {
        if (control.type === 'header') continue;
        next = setPath(next, control.path, control.def);
      }
      if (togglePath) next = setPath(next, togglePath, false);
      return next;
    });
    useProject.getState().commit();
  };

  return (
    <>
      {STYLE_SECTIONS.map(section => {
        const togglePath = section.togglePath;
        const toggleOn = togglePath ? Boolean(getPath(state, togglePath)) : undefined;

        return (
          <Section
            key={section.id}
            id={section.id}
            title={section.title}
            subtitle={section.subtitle}
            flat
            toggleOn={toggleOn}
            onToggle={
              togglePath
                ? next => {
                    useProject.getState().set(togglePath, next);
                    useProject.getState().commit();
                  }
                : undefined
            }
            onReset={() => resetSection(section.controls, togglePath)}
            modified={sectionModified(section, state)}
          >
            {section.controls.map((control, i) => (
              <ControlRenderer key={`${section.id}-${i}`} def={control} />
            ))}
          </Section>
        );
      })}
    </>
  );
}
