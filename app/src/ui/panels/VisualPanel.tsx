import { useProject } from '../../state/store';
import { getPath, setPath } from '../../state/path';
import { sectionModified } from '../../state/controls';
import { STYLE_SECTIONS } from './sections';
import { PRESET_KEYS, STYLE_PRESETS, presetBg } from '../presets';
import { Section } from '../controls/Section';
import { ControlRenderer } from '../controls/ControlRenderer';

/**
 * The look inspector. Every section comes from `sections/`, so this
 * component never needs to change when an effect is added or renamed.
 */
export function VisualPanel() {
  const state = useProject(s => s.state);

  const applyPreset = (key: string) => {
    const preset = STYLE_PRESETS[key];
    if (!preset) return;
    useProject.getState().mutate(s => {
      let next = s;
      for (const [group, values] of Object.entries(preset.s)) {
        for (const [key, value] of Object.entries(values)) {
          next = setPath(next, `style.${group}.${key}`, value);
        }
      }
      return next;
    });
    useProject.getState().commit();
  };

  return (
    <>
      <div className="presets">
        <div className="grp-h">One-click looks</div>
        <div className="presets">
          {PRESET_KEYS.map(key => {
            const preset = STYLE_PRESETS[key];
            return (
              <button
                key={key}
                className="preset"
                style={{ background: presetBg(key) }}
                onClick={() => applyPreset(key)}
                title={preset.name}
              >
                <div className="pv" />
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

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
            onReset={() => {
              useProject.getState().mutate(s => {
                let next = s;
                for (const control of section.controls) {
                  if (control.type === 'header') continue;
                  next = setPath(next, control.path, control.def);
                }
                if (section.togglePath) next = setPath(next, section.togglePath, false);
                return next;
              });
              useProject.getState().commit();
            }}
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