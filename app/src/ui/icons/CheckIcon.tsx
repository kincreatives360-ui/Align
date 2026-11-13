import { IconBase, type IconProps } from './IconBase';

export function CheckIcon(props: IconProps) {
  return (
    <IconBase defaultSize={12} {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </IconBase>
  );
}
