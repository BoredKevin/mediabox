import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  chamfer?: 'auto' | 'dual' | 'top-right' | 'bottom-right' | 'all' | 'none';
  wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, chamfer = 'auto', disabled, wrapperClassName, ...props }, ref) => {
    const chamferClass =
      chamfer === 'none'
        ? 'chamfer-none'
        : chamfer === 'dual'
        ? 'chamfer-dual'
        : chamfer === 'top-right' || chamfer === 'bottom-right'
        ? 'chamfer-tr'
        : chamfer === 'all'
        ? 'chamfer-all'
        : 'chamfer-active';

    // Extract height classes from className (e.g. h-11, h-9, h-8, h-12, h-10) to apply to wrapper
    const heightMatch = className?.match(/\b(h-(?:\[[^\]]+\]|\d+(?:\.\d+)?))\b/);
    const heightClass = heightMatch ? heightMatch[1] : 'h-9';
    // Remove the height class from the inner input so it uses h-full and doesn't overflow wrapper
    const cleanedClassName = className
      ? className.replace(/\b(h-(?:\[[^\]]+\]|\d+(?:\.\d+)?))\b/g, '').trim()
      : '';

    return (
      <div
        className={cn(
          'relative flex w-full p-[1px] bg-input/80 focus-within:bg-primary focus-within:scifi-glow-subtle transition-all duration-200 rounded-[var(--radius)]',
          heightClass,
          disabled && 'opacity-50 cursor-not-allowed',
          chamferClass,
          wrapperClassName
        )}
      >
        <input
          type={type}
          disabled={disabled}
          ref={ref}
          className={cn(
            'flex h-full w-full bg-background/80 backdrop-blur-md px-3 py-1 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 text-foreground rounded-[var(--radius)]',
            chamferClass,
            cleanedClassName
          )}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
