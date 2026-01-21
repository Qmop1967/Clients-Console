"use client";

import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { Minus, Plus, ChevronsUp, AlertCircle } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils/cn";

interface WholesaleQuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  disabled?: boolean;
  className?: string;
  translations: {
    max: string;
    available: string;
    exceededMax?: string;
  };
  onPreventNavigation?: (e: React.MouseEvent) => void;
}

export function WholesaleQuantityInput({
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
  className,
  translations,
  onPreventNavigation,
}: WholesaleQuantityInputProps) {
  const [inputValue, setInputValue] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);
  const [showExceededWarning, setShowExceededWarning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync inputValue with external value changes
  useEffect(() => {
    if (!isFocused) {
      setInputValue(String(value));
    }
  }, [value, isFocused]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, []);

  // Show exceeded warning with auto-hide
  const triggerExceededWarning = useCallback(() => {
    setShowExceededWarning(true);
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
    warningTimeoutRef.current = setTimeout(() => {
      setShowExceededWarning(false);
    }, 3000);
  }, []);

  // Handle direct input
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;

      // Allow empty input while typing
      if (rawValue === "") {
        setInputValue("");
        return;
      }

      // Only allow numbers
      const numericValue = rawValue.replace(/[^0-9]/g, "");
      setInputValue(numericValue);

      const parsed = parseInt(numericValue, 10);
      if (!isNaN(parsed)) {
        // Check if exceeds max and show warning
        if (parsed > max) {
          triggerExceededWarning();
        }
        // Clamp value to valid range
        const clampedValue = Math.min(Math.max(parsed, min), max);
        onChange(clampedValue);
      }
    },
    [min, max, onChange, triggerExceededWarning]
  );

  // Handle blur - validate and correct value
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const parsed = parseInt(inputValue, 10);
    if (isNaN(parsed) || parsed < min) {
      setInputValue(String(min));
      onChange(min);
    } else if (parsed > max) {
      triggerExceededWarning();
      setInputValue(String(max));
      onChange(max);
    } else {
      setInputValue(String(parsed));
      onChange(parsed);
    }
  }, [inputValue, min, max, onChange, triggerExceededWarning]);

  // Handle focus - select all text for easy replacement
  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    e.target.select();
  }, []);

  // Quick increment handlers
  const handleIncrement = useCallback(
    (e: React.MouseEvent, amount: number) => {
      onPreventNavigation?.(e);
      const newValue = Math.min(value + amount, max);
      setInputValue(String(newValue));
      onChange(newValue);
    },
    [value, max, onChange, onPreventNavigation]
  );

  const handleDecrement = useCallback(
    (e: React.MouseEvent, amount: number) => {
      onPreventNavigation?.(e);
      const newValue = Math.max(value - amount, min);
      setInputValue(String(newValue));
      onChange(newValue);
    },
    [value, min, onChange, onPreventNavigation]
  );

  // Set to specific quantity (for quick action buttons)
  const handleSetQuantity = useCallback(
    (e: React.MouseEvent, amount: number) => {
      onPreventNavigation?.(e);
      const newValue = Math.min(amount, max);
      setInputValue(String(newValue));
      onChange(newValue);
    },
    [max, onChange, onPreventNavigation]
  );

  // Set to max quantity
  const handleSetMax = useCallback(
    (e: React.MouseEvent) => {
      onPreventNavigation?.(e);
      setInputValue(String(max));
      onChange(max);
    },
    [max, onChange, onPreventNavigation]
  );

  // Handle click on wrapper to prevent navigation
  const handleWrapperClick = useCallback(
    (e: React.MouseEvent) => {
      onPreventNavigation?.(e);
    },
    [onPreventNavigation]
  );

  // Handle key press for Enter
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        inputRef.current?.blur();
      }
    },
    []
  );

  return (
    <div
      className={cn("space-y-2", className)}
      onClick={handleWrapperClick}
    >
      {/* Main quantity row */}
      <div className="flex items-center gap-1">
        {/* Decrement button */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-lg"
          onClick={(e) => handleDecrement(e, 1)}
          disabled={disabled || value <= min}
          aria-label="Decrease quantity"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </Button>

        {/* Editable input */}
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onClick={handleWrapperClick}
          disabled={disabled}
          aria-label="Quantity"
          className={cn(
            "h-9 w-full min-w-[60px] flex-1 rounded-lg border bg-background px-2 text-center text-lg font-semibold tabular-nums",
            "transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
            "disabled:cursor-not-allowed disabled:opacity-50",
            isFocused && "ring-2 ring-primary/50 border-primary"
          )}
        />

        {/* Increment button */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-lg"
          onClick={(e) => handleIncrement(e, 1)}
          disabled={disabled || value >= max}
          aria-label="Increase quantity"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Quick actions row - Physical button style */}
      <div className="grid grid-cols-3 gap-2">
        {/* 10 Button */}
        <button
          type="button"
          onClick={(e) => handleSetQuantity(e, 10)}
          disabled={disabled || value >= max}
          aria-label="Set quantity to 10"
          className={cn(
            "h-10 px-2 rounded-xl text-sm font-bold tabular-nums whitespace-nowrap",
            "bg-gradient-to-b from-muted/90 to-muted",
            "border border-border/60",
            "shadow-[0_3px_0_0_hsl(var(--border)),inset_0_1px_0_0_rgba(255,255,255,0.08)]",
            "hover:shadow-[0_2px_0_0_hsl(var(--border)),inset_0_1px_0_0_rgba(255,255,255,0.08)]",
            "hover:translate-y-[1px]",
            "active:shadow-[0_0px_0_0_hsl(var(--border))] active:translate-y-[3px]",
            "transition-all duration-75",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_3px_0_0_hsl(var(--border)),inset_0_1px_0_0_rgba(255,255,255,0.08)]"
          )}
        >
          10
        </button>

        {/* 100 Button */}
        <button
          type="button"
          onClick={(e) => handleSetQuantity(e, 100)}
          disabled={disabled || value >= max}
          aria-label="Set quantity to 100"
          className={cn(
            "h-10 px-2 rounded-xl text-sm font-bold tabular-nums whitespace-nowrap",
            "bg-gradient-to-b from-muted/90 to-muted",
            "border border-border/60",
            "shadow-[0_3px_0_0_hsl(var(--border)),inset_0_1px_0_0_rgba(255,255,255,0.08)]",
            "hover:shadow-[0_2px_0_0_hsl(var(--border)),inset_0_1px_0_0_rgba(255,255,255,0.08)]",
            "hover:translate-y-[1px]",
            "active:shadow-[0_0px_0_0_hsl(var(--border))] active:translate-y-[3px]",
            "transition-all duration-75",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_3px_0_0_hsl(var(--border)),inset_0_1px_0_0_rgba(255,255,255,0.08)]"
          )}
        >
          100
        </button>

        {/* Max Button - Gold accent */}
        <button
          type="button"
          onClick={handleSetMax}
          disabled={disabled || value >= max}
          aria-label="Set to maximum quantity"
          className={cn(
            "h-10 px-2 rounded-xl text-sm font-bold whitespace-nowrap",
            "inline-flex items-center justify-center gap-1",
            "bg-gradient-to-b from-amber-500/25 to-amber-600/30",
            "border border-amber-500/50",
            "text-amber-500 dark:text-amber-400",
            "shadow-[0_3px_0_0_rgba(180,120,30,0.5),inset_0_1px_0_0_rgba(255,255,255,0.15)]",
            "hover:shadow-[0_2px_0_0_rgba(180,120,30,0.5),inset_0_1px_0_0_rgba(255,255,255,0.15)]",
            "hover:translate-y-[1px] hover:bg-gradient-to-b hover:from-amber-500/30 hover:to-amber-600/35",
            "active:shadow-[0_0px_0_0_rgba(180,120,30,0.5)] active:translate-y-[3px]",
            "transition-all duration-75",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_3px_0_0_rgba(180,120,30,0.5),inset_0_1px_0_0_rgba(255,255,255,0.15)]"
          )}
        >
          <ChevronsUp className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{translations.max}</span>
        </button>
      </div>

      {/* Available stock indicator / Exceeded warning */}
      <div className="relative h-5">
        {/* Normal available text */}
        <div
          className={cn(
            "text-center text-[10px] text-muted-foreground transition-all duration-300",
            showExceededWarning ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
          )}
        >
          {translations.available}: <span className="font-medium tabular-nums">{max}</span>
        </div>

        {/* Exceeded warning message */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center gap-1.5 text-[11px] font-medium text-red-500 dark:text-red-400 transition-all duration-300",
            showExceededWarning ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
          )}
        >
          <AlertCircle className="h-3.5 w-3.5 animate-pulse" />
          <span>{translations.exceededMax || `Maximum available: ${max}`}</span>
        </div>
      </div>
    </div>
  );
}
