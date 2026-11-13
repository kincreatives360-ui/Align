import { IconBase, type IconProps } from './IconBase';

export function MotionIcon(props: IconProps) {
  return (
    <IconBase defaultSize={18} {...props}>
      <path d="M3 17c3 0 4-10 7-10s3 10 6 10 3-6 5-6" />
    </IconBase>
  );
}
