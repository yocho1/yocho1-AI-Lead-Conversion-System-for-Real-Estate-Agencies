import { clsx } from "clsx";
import type { HTMLAttributes, PropsWithChildren } from "react";

type SurfaceCardProps = PropsWithChildren<{
  className?: string;
  elevated?: boolean;
}> &
  HTMLAttributes<HTMLElement>;

export function SurfaceCard({ className, children, elevated = true, ...props }: SurfaceCardProps) {
  return (
    <section className={clsx("surface-card rounded-[20px] border p-4", elevated && "hover:-translate-y-[2px]", className)} {...props}>
      {children}
    </section>
  );
}
