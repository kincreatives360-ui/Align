import { IconBase, type IconProps } from './IconBase';

export function BackIcon(props: IconProps) {
  return (
    <IconBase defaultSize={14} {...props}>
      <path d="M15 6l-6 6 6 6" />
    </IconBase>
  );
}
