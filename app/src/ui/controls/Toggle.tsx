import { Row } from './Row';
import type { ToggleControl } from '../../state/controls';

interface Props {
  def: ToggleControl;
  value: boolean;
  onChange: (value: boolean) => void;
  onCommit: () => void;
}

export function Toggle({ def, value, onChange, onCommit }: Props) {
  return (
    <Row label={def.label} hint={def.hint}>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={def.label}
        className={`tg${value ? ' on' : ''}`}
        onClick={e => {
          e.stopPropagation();
          onChange(!value);
          onCommit();
        }}
      />
    </Row>
  );
}
