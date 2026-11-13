import { IconBase, type IconProps } from './IconBase';

export function SparkleIcon(props: IconProps) {
  return (
    <IconBase defaultSize={17} {...props}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 3v4M17 5h4" />
    </IconBase>
  );
}
