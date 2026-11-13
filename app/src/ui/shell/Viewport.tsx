import { useProjectState } from '../hooks/useProject';
import { useFitBox } from '../hooks/useFitBox';
import { SafeGuides } from './SafeGuides';
import { SafeZones } from './SafeZones';
import { StageCanvas } from '../canvas/StageCanvas';

/** Frame shape → width ÷ height. */
const RATIOS: Record<string, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
  '4:5': 4 / 5,
  '5:4': 5 / 4,
  '4:3': 4 / 3,
  '3:4': 3 / 4,
  '21:9': 21 / 9,
  '2:3': 2 / 3,
};

/** The canvas area: a centred, aspect-correct frame with its overlays. */
export function Viewport() {
  const aspect = useProjectState(s => s.frame.aspect);
  const [ref, box] = useFitBox(RATIOS[aspect] ?? 16 / 9);

  return (
    <div className="view" id="view" ref={ref}>
      <div className="canvas-wrap" id="wrap" style={{ width: box.width, height: box.height }}>
        <StageCanvas />
        <SafeGuides />
        <SafeZones />
      </div>
    </div>
  );
}
