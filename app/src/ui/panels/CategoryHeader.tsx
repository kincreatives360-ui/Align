import { ChevronIcon } from '../icons/ChevronIcon';

interface Props {
  id: string;
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}

export function CategoryHeader({ label, count, open, onToggle }: Props) {
  return (
    <button
      type="button"
      className={`cat-h${open ? ' open' : ''}`}
      aria-expanded={open}
      onClick={onToggle}
    >
      <span className="chev">
        <ChevronIcon />
      </span>
      <span className="nm">{label}</span>
      <span className="ct">{count}</span>
    </button>
  );
}
