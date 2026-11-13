import { Row } from './Row';
import type { SegmentedControl } from '../../state/controls';

interface Props {
  def: SegmentedControl;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}

/** A row of buttons. One click is one gesture, so it commits immediately. */
export function Segmented({ def, value, onChange, onCommit }: Props) {
  return (
    <Row label={def.label} hint={def.hint}>
      <div className="sg" role="group" aria-label={def.label}>
        {def.options.map(opt => (
          <button
            key={opt.value}
            type="button"
            title={opt.label}
            className={String(value) === opt.value ? 'on' : ''}
            aria-pressed={String(value) === opt.value}
            onClick={() => {
              onChange(opt.value);
              onCommit();
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </Row>
  );
}
