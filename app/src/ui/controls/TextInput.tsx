import { Row } from './Row';
import type { TextControl } from '../../state/controls';

interface Props {
  def: TextControl;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}

export function TextInput({ def, value, onChange, onCommit }: Props) {
  return (
    <Row label={def.label} hint={def.hint}>
      <input
        className="txt"
        aria-label={def.label}
        placeholder={def.placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => onCommit()}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </Row>
  );
}
