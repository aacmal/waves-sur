/* eslint-disable react-refresh/only-export-components */
import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { ComponentPropsWithoutRef, ElementRef } from "react";
import { forwardRef } from "react";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export const PopoverContent = forwardRef<
  ElementRef<typeof PopoverPrimitive.Content>,
  ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className = "", align = "center", sideOffset = 8, forceMount, ...props }, ref) => (
  <PopoverPrimitive.Portal forceMount={forceMount}>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      forceMount={forceMount}
      className={`z-50 rounded-xl border border-white/12 bg-[#151620]/96 p-3 text-white shadow-[0_16px_40px_rgb(0_0_0/30%)] backdrop-blur-xl outline-none data-[state=closed]:animate-out data-[state=open]:animate-in ${className}`}
      {...props}
    />
  </PopoverPrimitive.Portal>
));

PopoverContent.displayName = PopoverPrimitive.Content.displayName;
