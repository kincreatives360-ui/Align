import { IconBase, type IconProps } from './IconBase';

export function RedoIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H10a6 6 0 0 0 0 12h3" />
    </IconBase>
  );
}
