import { IconBase, type IconProps } from './IconBase';

/** Crosshair — used to mark the "compare / reset look" control. */
export function CompareIcon(props: IconProps) {
  return (
    <IconBase defaultSize={18} {...props}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </IconBase>
  );
}
