import type { Template } from '../../templates/types';
import { TemplateCard } from './TemplateCard';

interface Props {
  items: Template[];
}

export function TemplateGrid({ items }: Props) {
  return (
    <div className="tgrid">
      {items.map(t => (
        <TemplateCard key={t.id} template={t} />
      ))}
    </div>
  );
}
