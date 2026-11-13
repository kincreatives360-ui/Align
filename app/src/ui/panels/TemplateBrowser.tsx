import { useUi } from '../../state/uiStore';
import { TEMPLATES } from '../../templates/registry';
import { SearchField } from './SearchField';
import { CategoryList } from './CategoryList';
import { SearchResults } from './SearchResults';

/** Search box, then one accordion per category with its templates inside. */
export function TemplateBrowser() {
  const search = useUi(s => s.search);
  const trimmed = search.trim();
  const lower = trimmed.toLowerCase();

  const results = trimmed
    ? TEMPLATES.filter(t => `${t.name} ${t.desc ?? ''}`.toLowerCase().includes(lower))
    : [];

  return (
    <>
      <SearchField value={search} onChange={q => useUi.getState().setSearch(q)} />
      {trimmed ? <SearchResults items={results} /> : <CategoryList />}
    </>
  );
}
