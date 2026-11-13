import { IconBase, type IconProps } from './IconBase';

export function UndoIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </IconBase>
  );
}
