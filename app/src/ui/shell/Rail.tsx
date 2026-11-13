import { useUi } from '../../state/uiStore';
import { MotionIcon } from '../icons/MotionIcon';
import { ImageIcon } from '../icons/ImageIcon';
import { TextIcon } from '../icons/TextIcon';
import { FolderIcon } from '../icons/FolderIcon';
import { RailButton } from './RailButton';

const SECTIONS = [
  { k: 'motion', label: 'Motion', Icon: MotionIcon },
  { k: 'media', label: 'Media', Icon: ImageIcon },
  { k: 'text', label: 'Text', Icon: TextIcon },
  { k: 'project', label: 'Project', Icon: FolderIcon },
] as const;

/** The narrow icon rail down the left edge. */
export function Rail() {
  const active = useUi(s => s.rail);

  return (
    <nav className="panel rail" aria-label="Sections">
      {SECTIONS.map(({ k, label, Icon }) => (
        <RailButton
          key={k}
          section={k}
          label={label}
          Icon={Icon}
          active={active === k}
        />
      ))}
    </nav>
  );
}
