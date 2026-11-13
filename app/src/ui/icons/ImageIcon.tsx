import { IconBase, type IconProps } from './IconBase';

export function ImageIcon(props: IconProps) {
  return (
    <IconBase defaultSize={18} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16l-5-5-9 9" />
    </IconBase>
  );
}
