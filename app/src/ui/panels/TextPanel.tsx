import { TitleSection } from './TitleSection';
import { LabelsSection } from './LabelsSection';
import { LogoSection } from './LogoSection';

/** Everything drawn on top of the frame: title, corner labels, logo. */
export function TextPanel() {
  return (
    <>
      <TitleSection />
      <LabelsSection />
      <LogoSection />
    </>
  );
}
