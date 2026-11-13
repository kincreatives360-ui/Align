import { Row } from './Row';
import type { ColorControl } from '../../state/controls';

interface Props {
  def: ColorControl;
  value: string;
  /** Live update while the picker moves. */
  onChange: (value: string) => void;
  /** One pick is one undo step. */
  onCommit: () => void;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Native colour well plus a hex field you can type into. */
export function ColorInput({ def, value, onChange, onCommit }: Props) {
  return (
    <Row label={def.label} hint={def.hint}>
      <div className="col">
        <input
          type="color"
          aria-label={`${def.label} colour`}
          value={HEX.test(value) ? value : '#000000'}
          onInput={e => onChange(e.currentTarget.value)}
          onChange={() => onCommit()}
        />
        <input
          className="txt"
          aria-label={`${def.label} hex`}
          value={value}
          spellCheck={false}
          onChange={e => onChange(e.target.value)}
          onBlur={() => {
            if (HEX.test(value)) onCommit();
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </div>
    </Row>
  );
}
