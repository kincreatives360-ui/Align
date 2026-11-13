import { useProject } from '../../state/store';
import { applyTemplate } from '../../templates/select';
import type { Template } from '../../templates/types';

interface Props {
  template: Template;
}

/**
 * One template tile. The thumbnail is a canvas — live-rendered from the
 * real engine in Milestone 4 — sitting on the checker background until then.
 */
export function TemplateCard({ template }: Props) {
  const active = useProject(s => s.state.templateId) === template.id;

  const apply = () => {
    useProject.getState().mutate(s => applyTemplate(s, template));
    useProject.getState().commit();
  };

  return (
    <button
      type="button"
      className={`tpl${active ? ' on' : ''}`}
      aria-pressed={active}
      onClick={apply}
    >
      <span className="th">
        {template.isNew && <span className="badge">New</span>}
      </span>
      <span className="nm">{template.name}</span>
    </button>
  );
}
