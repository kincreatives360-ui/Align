import { IconBase, type IconProps } from './IconBase';

export function SearchIcon(props: IconProps) {
  return (
    <IconBase defaultSize={14} {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4-4" />
    </IconBase>
  );
}
