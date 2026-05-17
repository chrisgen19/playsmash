import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Material Design 3 button variants.
 * - filled:    primary CTA (high emphasis)
 * - tonal:     secondary-container fill (medium emphasis)
 * - outlined:  outlined, transparent fill
 * - text:      no container, used in dense rows or dialogs
 * - elevated:  surface w/ elevation-1 + primary text
 * - destructive: error-container fill
 *
 * Sizes mirror M3: default ~40px, sm 32px, lg 48px (for hero CTA),
 * icon for icon-only, fab for floating-action-button (56px).
 */
const buttonVariants = cva(
  [
    "md-state-layer group/button relative inline-flex shrink-0 items-center justify-center",
    "rounded-full border border-transparent text-sm font-medium tracking-wide",
    "whitespace-nowrap transition-all outline-none select-none",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "active:not-aria-[haspopup]:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-40 disabled:bg-on-surface/10",
    "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  ].join(" "),
  {
    variants: {
      variant: {
        filled: "bg-primary text-primary-foreground",
        tonal: "bg-secondary text-secondary-foreground",
        outlined:
          "border-outline-variant border-[color:var(--md-sys-color-outline)] bg-transparent text-primary",
        text: "bg-transparent text-primary px-3",
        elevated:
          "bg-[color:var(--md-sys-color-surface-container-low)] text-primary md-elev-1 hover:md-elev-2",
        destructive: "bg-destructive text-[color:var(--md-sys-color-on-error)]",
        // legacy aliases (preserve existing call sites without rewriting)
        default: "bg-primary text-primary-foreground",
        accent:
          "bg-[color:var(--md-sys-color-primary-container)] text-[color:var(--md-sys-color-on-primary-container)]",
        secondary: "bg-secondary text-secondary-foreground",
        outline:
          "border-[color:var(--md-sys-color-outline)] bg-transparent text-primary",
        ghost: "bg-transparent text-foreground",
        link: "bg-transparent text-primary underline-offset-4 hover:underline px-0",
      },
      size: {
        default: "h-10 gap-2 px-6",
        sm: "h-8 gap-1.5 px-4 text-[13px]",
        lg: "h-12 gap-2 px-7 text-base",
        xl: "h-14 gap-2.5 px-8 text-base",
        xs: "h-7 gap-1 px-3 text-xs",
        icon: "size-10 px-0",
        "icon-sm": "size-8 px-0",
        "icon-lg": "size-12 px-0",
        "icon-xs": "size-7 px-0",
        fab: "h-14 gap-3 rounded-2xl px-5 text-base md-elev-3 hover:md-elev-3",
        "fab-icon": "size-14 rounded-2xl md-elev-3 hover:md-elev-3 [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "filled",
      size: "default",
    },
  },
)

function Button({
  className,
  variant = "filled",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
