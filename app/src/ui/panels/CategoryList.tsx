import { CATEGORIES } from '../../templates/registry';
import { CategoryGroup } from './CategoryGroup';

/** Every category, each an independent accordion. */
export function CategoryList() {
  return (
    <>
      {CATEGORIES.map(cat => (
        <CategoryGroup key={cat.id} category={cat} />
      ))}
    </>
  );
}
