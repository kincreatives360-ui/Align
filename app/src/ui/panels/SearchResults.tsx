import type { Template } from '../../templates/types';
import { TemplateGrid } from './TemplateGrid';

interface Props {
  items: Template[];
}

/** The flat list shown while the search box has text. */
export function SearchResults({ items }: Props) {
  if (items.length === 0) {
    return <p className="hint" style={{ padding: '8px 4px' }}>No templates match.</p>;
  }

  return (
    <>
      <div className="cat-h open" style={{ cursor: 'default' }}>
        <span className="nm">Results</span>
        <span className="ct">{items.length}</span>
      </div>
      <TemplateGrid items={items} />
    </>
  );
}
