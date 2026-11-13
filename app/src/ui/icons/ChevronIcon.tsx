import { IconBase, type IconProps } from './IconBase';

export function ChevronIcon(props: IconProps) {
  return (
    <IconBase defaultSize={14} {...props}>
      <path d="M9 6l6 6-6 6" />
    </IconBase>
  );
}
