// Popover de shadcn/ui adaptado a Tailwind 3 + @radix-ui/react-popover y a la
// paleta de la app (slate). z-[60]: tiene que quedar arriba del Modal (z-50).
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '../../utils.js';

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

function PopoverContent({ className, align = 'start', sideOffset = 4, ...props }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-[60] rounded-lg border border-slate-200 bg-white shadow-lg outline-none animate-fade-in',
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent };
