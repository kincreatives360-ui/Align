import { useUi } from '../../state/uiStore';
import type { IconProps } from '../icons/IconBase';
import type { ReactElement } from 'react';

interface Props {
  section: 'motion' | 'media' | 'text' | 'project';
  label: string;
  Icon: (props: IconProps) => ReactElement;
  active: boolean;
}

export function RailButton({ section, label, Icon, active }: Props) {
  const select = () => useUi.getState().setRail(section);

  return (
    <button
      data-k={section}
      className={active ? 'on' : ''}
      aria-current={active ? 'page' : undefined}
      onClick={select}
    >
      <span className="ic">
        <Icon />
      </span>
      {label}
    </button>
  );
}
