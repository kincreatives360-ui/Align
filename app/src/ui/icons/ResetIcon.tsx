import { IconBase, type IconProps } from './IconBase';

/** The circular "back to start" arrow — also used as the look reset control. */
export function ResetIcon(props: IconProps) {
  return (
    <IconBase defaultSize={14} {...props}>
      <path d="M4 12a8 8 0 1 0 2.6-5.9" />
      <path d="M4 4v4h4" />
    </IconBase>
  );
}
