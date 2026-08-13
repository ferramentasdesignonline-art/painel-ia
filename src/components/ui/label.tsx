"use client"

import * as React from "react"
import { Field } from "@base-ui/react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none select-none group-data-[disabled]/field:pointer-events-none group-data-[disabled]/field:opacity-50"
)

const Label = React.forwardRef<
  React.ElementRef<typeof Field.Label>,
  React.ComponentPropsWithoutRef<typeof Field.Label> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <Field.Label
    ref={ref}
    data-slot="label"
    className={cn(labelVariants(), className)}
    {...props}
  />
))
Label.displayName = "Label"

export { Label }
