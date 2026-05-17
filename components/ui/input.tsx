import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * MD3 filled text-field. Surface tinting + strong bottom indicator.
 * Floating-label behaviour is opt-in via the parent layout — this
 * primitive provides the field chrome only so it stays drop-in
 * compatible with all existing usages.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-14 w-full min-w-0 rounded-t-md rounded-b-none",
        "border-0 border-b-2 border-[color:var(--md-sys-color-on-surface-variant)]",
        "bg-[color:var(--md-sys-color-surface-container-highest)] px-4 pt-5 pb-2",
        "md-body-lg text-foreground transition-colors outline-none",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "placeholder:text-muted-foreground",
        "hover:bg-[color:var(--md-sys-color-surface-container-high)]",
        "focus-visible:border-b-[3px] focus-visible:border-[color:var(--md-sys-color-primary)]",
        "focus-visible:pb-[7px]",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
        "aria-invalid:border-[color:var(--md-sys-color-error)] aria-invalid:focus-visible:border-[color:var(--md-sys-color-error)]",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
