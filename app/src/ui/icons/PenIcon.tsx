import { IconBase, type IconProps } from './IconBase';

export function PenIcon(props: IconProps) {
  return (
    <IconBase defaultSize={14} {...props}>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </IconBase>
  );
}
