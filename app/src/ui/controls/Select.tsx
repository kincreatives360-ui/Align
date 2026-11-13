import { Row } from './Row';
import type { SelectControl } from '../../state/controls';

interface Props {
  def: SelectControl;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}

/** A styled native `<select>` — keyboard and screen-reader behaviour for free. */
export function Select({ def, value, onChange, onCommit }: Props) {
  return (
    <Row label={def.label} hint={def.hint}>
      <select
        className="sel"
        aria-label={def.label}
        value={String(value)}
        onChange={e => {
          onChange(e.target.value);
          onCommit();
        }}
      >
        {def.options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </Row>
  );
}
