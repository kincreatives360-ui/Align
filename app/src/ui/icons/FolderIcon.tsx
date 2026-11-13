import { IconBase, type IconProps } from './IconBase';

export function FolderIcon(props: IconProps) {
  return (
    <IconBase defaultSize={18} {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </IconBase>
  );
}
