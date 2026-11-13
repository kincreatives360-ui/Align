import { IconBase, type IconProps } from './IconBase';

export function SaveIcon(props: IconProps) {
  return (
    <IconBase defaultSize={15} {...props}>
      <path d="M5 4h11l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M8 4v5h7V4M8 20v-6h8v6" />
    </IconBase>
  );
}
