import type { ReactNode } from 'react';

/**
 * The shared frame every icon sits in: a 24×24 box, current-colour stroke,
 * rounded caps. Individual icons only supply their paths.
 */
export interface IconProps {
  /** Rendered pixel size. Defaults to the original's 16. */
  size?: number;
  className?: string;
}

export function IconBase({
  size,
  defaultSize = 16,
  className,
  children,
}: IconProps & { children: ReactNode; defaultSize?: number }) {
  const px = size ?? defaultSize;
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}
