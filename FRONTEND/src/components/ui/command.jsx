// Command de shadcn/ui (sobre cmdk) adaptado a Tailwind 3 y a la paleta de la
// app (slate + primary). Misma estructura que el registry oficial.
import { Command as CommandPrimitive } from 'cmdk';
import { Search } from 'lucide-react';
import { cn } from '../../utils.js';

function Command({ className, ...props }) {
  return (
    <CommandPrimitive
      className={cn('flex h-full w-full flex-col overflow-hidden rounded-lg bg-white text-slate-700', className)}
      {...props}
    />
  );
}

function CommandInput({ className, ...props }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 px-3">
      <Search size={16} className="flex-shrink-0 text-slate-400" />
      <CommandPrimitive.Input
        className={cn(
          'flex h-10 w-full bg-transparent py-2 text-base md:text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({ className, ...props }) {
  return (
    <CommandPrimitive.List
      className={cn('overflow-y-auto overflow-x-hidden overscroll-contain', className)}
      {...props}
    />
  );
}

function CommandEmpty({ className, ...props }) {
  return <CommandPrimitive.Empty className={cn('py-6 text-center text-sm text-slate-400', className)} {...props} />;
}

function CommandGroup({ className, ...props }) {
  return <CommandPrimitive.Group className={cn('p-1', className)} {...props} />;
}

function CommandItem({ className, ...props }) {
  return (
    <CommandPrimitive.Item
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none',
        'data-[selected=true]:bg-primary-50 data-[selected=true]:text-primary-700',
        'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
        className
      )}
      {...props}
    />
  );
}

export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem };
