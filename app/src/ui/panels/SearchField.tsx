import { SearchIcon } from '../icons/SearchIcon';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function SearchField({ value, onChange }: Props) {
  return (
    <div className="search">
      <SearchIcon />
      <input
        type="search"
        placeholder="Search templates"
        aria-label="Search templates"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
