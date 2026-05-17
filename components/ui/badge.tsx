import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * MD3 assist / filter / input chip styles, exposed via shadcn Badge API.
 */
const badgeVariants = cva(
  [
    "group/badge inline-flex h-7 w-fit shrink-0 items-center justify-center gap-1.5",
    "overflow-hidden rounded-md border border-transparent px-3 py-1",
    "md-label-md whitespace-nowrap transition-all",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
    "has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
    "aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3.5!",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-[color:var(--md-sys-color-primary-container)] text-[color:var(--md-sys-color-on-primary-container)]",
        accent:
          "bg-[color:var(--md-sys-color-tertiary-container)] text-[color:var(--md-sys-color-on-tertiary-container)]",
        secondary: "bg-secondary text-secondary-foreground",
        destructive:
          "bg-[color:var(--md-sys-color-error-container)] text-[color:var(--md-sys-color-on-error-container)]",
        outline:
          "border-[color:var(--md-sys-color-outline)] bg-transparent text-foreground",
        ghost: "bg-transparent text-muted-foreground hover:bg-muted",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
