import { IconBase, type IconProps } from './IconBase';

export function LockIcon(props: IconProps) {
  return (
    <IconBase defaultSize={14} {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </IconBase>
  );
}
