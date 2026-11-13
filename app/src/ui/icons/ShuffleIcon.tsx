import { IconBase, type IconProps } from './IconBase';

export function ShuffleIcon(props: IconProps) {
  return (
    <IconBase defaultSize={14} {...props}>
      <path d="M3 7h3c4 0 6 10 10 10h5M3 17h3c1.5 0 2.7-1.3 3.7-3M14.3 10C15.3 8.3 16.5 7 18 7h3M18 4l3 3-3 3M18 14l3 3-3 3" />
    </IconBase>
  );
}
