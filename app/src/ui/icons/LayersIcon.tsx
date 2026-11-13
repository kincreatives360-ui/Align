import { IconBase, type IconProps } from './IconBase';

export function LayersIcon(props: IconProps) {
  return (
    <IconBase defaultSize={18} {...props}>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </IconBase>
  );
}
