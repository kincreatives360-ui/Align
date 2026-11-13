import { IconBase, type IconProps } from './IconBase';

export function FullscreenIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </IconBase>
  );
}
