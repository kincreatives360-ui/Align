import { IconBase, type IconProps } from './IconBase';

export function TextIcon(props: IconProps) {
  return (
    <IconBase defaultSize={18} {...props}>
      <path d="M5 6V4h14v2M12 4v16M9 20h6" />
    </IconBase>
  );
}
