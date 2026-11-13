import { useProject } from '../../state/store';
import { BASE_STYLE } from '../../state/defaults';
import { ResetIcon } from '../icons/ResetIcon';
import { toast } from '../../state/toastStore';

/** Put every look setting back to the neutral default. */
export function ResetLookButton() {
  return (
    <button
      className="ib"
      title="Reset look to template default"
      aria-label="Reset look"
      onClick={() => {
        useProject.getState().mutate(s => ({ ...s, style: structuredClone(BASE_STYLE) }));
        useProject.getState().commit();
        toast('Look reset');
      }}
    >
      <ResetIcon />
    </button>
  );
}
