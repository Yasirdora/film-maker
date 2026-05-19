"use client";

/**
 * DropdownMenu — accessible menu primitives built on @radix-ui.
 *
 * Modeled on shadcn/ui's dropdown-menu, scoped to the parts the editor
 * actually composes today (Root / Trigger / Content / Item /
 * RadioGroup / RadioItem / Separator). Add new parts only when a real
 * use case lands; tracking the upstream shadcn API exactly isn't worth
 * the maintenance cost while we only use a fraction of it.
 *
 * Radix handles roving tabindex, arrow-key navigation, type-ahead,
 * Escape / outside-click dismissal, focus restoration and ARIA wiring,
 * so consumers get all of that for free.
 */

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

/**
 * Floating surface that renders the menu items. Wrapped in
 * `DropdownMenuPortal` so the surface escapes any `overflow: hidden`
 * ancestor — important inside the PageBar / toolbars.
 */
export const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(function DropdownMenuContent(
  { className, sideOffset = 6, align = "end", ...props },
  ref,
) {
  return (
    <DropdownMenuPortal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "z-50 min-w-[200px] overflow-hidden rounded-xl border p-1",
          "bg-[#161616] border-white/10",
          "shadow-[0_16px_40px_rgba(0,0,0,0.6),0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]",
          className,
        )}
        {...props}
      />
    </DropdownMenuPortal>
  );
});

/** Plain action row. Use `DropdownMenuRadioItem` for selectable state. */
export const DropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(function DropdownMenuItem({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex w-full cursor-default select-none items-center gap-3 rounded-lg px-2.5 py-2",
        "text-[13px] text-white outline-none transition-colors",
        "focus:bg-white/[0.06] data-[highlighted]:bg-white/[0.06]",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        className,
      )}
      {...props}
    />
  );
});

/**
 * Radio item — owns its own "selected" affordance (a trailing check) so
 * the consumer can drop children that are just the row content.
 */
export const DropdownMenuRadioItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(function DropdownMenuRadioItem({ className, children, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      className={cn(
        "relative flex w-full cursor-default select-none items-center gap-3 rounded-lg px-2.5 py-2",
        "text-[13px] text-white outline-none transition-colors",
        "focus:bg-white/[0.06] data-[highlighted]:bg-white/[0.06]",
        "data-[state=checked]:bg-white/[0.06]",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        className,
      )}
      {...props}
    >
      <span className="flex-1 min-w-0">{children}</span>
      <DropdownMenuPrimitive.ItemIndicator className="shrink-0">
        <Check className="size-3.5" strokeWidth={2.25} />
      </DropdownMenuPrimitive.ItemIndicator>
    </DropdownMenuPrimitive.RadioItem>
  );
});

export const DropdownMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={cn("my-1 h-px bg-white/10", className)}
      {...props}
    />
  );
});
