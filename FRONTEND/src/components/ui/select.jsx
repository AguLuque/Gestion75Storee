// Primitivos de Select de shadcn/ui (misma estructura que el registry oficial),
// adaptados a Tailwind 3 + @radix-ui/react-select y a la paleta de la app
// (slate + primary). Los formularios no los usan directo: usan el wrapper
// <Select> de ./index.jsx, que mantiene la API del <select> nativo.
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../utils.js';

// Alto máximo del desplegable: 16rem (256px), o menos si no entra en pantalla
// debajo del trigger (Radix calcula el espacio disponible en esa variable).
const ALTO_MAXIMO = 'max-h-[min(16rem,var(--radix-select-content-available-height))]';

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

function SelectTrigger({ className, children, ...props }) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'flex w-full items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 text-base md:text-sm text-left bg-white transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
        'data-[placeholder]:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50',
        '[&>span]:truncate',
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown size={16} className="flex-shrink-0 text-slate-400" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectScrollUpButton({ className, ...props }) {
  return (
    <SelectPrimitive.ScrollUpButton
      className={cn('flex cursor-default items-center justify-center py-1 text-slate-400', className)}
      {...props}
    >
      <ChevronUp size={14} />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({ className, ...props }) {
  return (
    <SelectPrimitive.ScrollDownButton
      className={cn('flex cursor-default items-center justify-center py-1 text-slate-400', className)}
      {...props}
    >
      <ChevronDown size={14} />
    </SelectPrimitive.ScrollDownButton>
  );
}

// Siempre abre hacia abajo: position="popper" + side="bottom" y sin
// avoidCollisions (que es lo que lo daba vuelta hacia arriba). Si abajo no hay
// lugar, en vez de salirse de la pantalla se achica y scrollea (ALTO_MAXIMO).
// z-[60]: tiene que quedar arriba del Modal (z-50).
function SelectContent({ className, children, ...props }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        side="bottom"
        sideOffset={4}
        avoidCollisions={false}
        collisionPadding={8}
        className={cn(
          'relative z-[60] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg animate-fade-in',
          ALTO_MAXIMO,
          className
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({ className, children, ...props }) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-md py-2 pl-8 pr-2 text-sm text-slate-700 outline-none',
        'data-[highlighted]:bg-primary-50 data-[highlighted]:text-primary-700 data-[state=checked]:font-medium',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-4 w-4 items-center justify-center text-primary-600">
        <SelectPrimitive.ItemIndicator>
          <Check size={14} />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem, SelectScrollUpButton, SelectScrollDownButton };
