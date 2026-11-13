import { IconBase, type IconProps } from './IconBase';

export function CloseIcon(props: IconProps) {
  return (
    <IconBase defaultSize={12} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </IconBase>
  );
}
