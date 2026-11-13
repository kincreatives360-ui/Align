import { useUi } from '../../state/uiStore';
import { TEMPLATES, countIn } from '../../templates/registry';
import type { CategoryInfo } from '../../templates/types';
import { CategoryHeader } from './CategoryHeader';
import { TemplateGrid } from './TemplateGrid';

interface Props {
  category: CategoryInfo;
}

/** One accordion: a header with a count, and the templates in that category. */
export function CategoryGroup({ category }: Props) {
  const open = useUi(s => s.openCats[category.id] ?? false);
  const items = TEMPLATES.filter(t => t.cat === category.id);
  const count = countIn(category.id);

  return (
    <>
      <CategoryHeader
        id={category.id}
        label={category.label}
        count={count}
        open={open}
        onToggle={() => useUi.getState().toggleCat(category.id)}
      />
      {open && <TemplateGrid items={items} />}
    </>
  );
}
