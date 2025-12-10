"use client";

import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { Minus, Plus, ChevronsUp } from "lucide-react";
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
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync inputValue with external value changes
  useEffect(() => {
    if (!isFocused) {
      setInputValue(String(value));
    }
  }, [value, isFocused]);

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
        // Clamp value to valid range
        const clampedValue = Math.min(Math.max(parsed, min), max);
        onChange(clampedValue);
      }
    },
    [min, max, onChange]
  );

  // Handle blur - validate and correct value
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const parsed = parseInt(inputValue, 10);
    if (isNaN(parsed) || parsed < min) {
      setInputValue(String(min));
      onChange(min);
    } else if (parsed > max) {
      setInputValue(String(max));
      onChange(max);
    } else {
      setInputValue(String(parsed));
      onChange(parsed);
    }
  }, [inputValue, min, max, onChange]);

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
        >
          <Minus className="h-4 w-4" />
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
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick actions row */}
      <div className="flex items-center gap-1">
        {/* Quick increment buttons */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 flex-1 text-xs font-medium hover:bg-secondary"
          onClick={(e) => handleIncrement(e, 10)}
          disabled={disabled || value >= max}
        >
          +10
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 flex-1 text-xs font-medium hover:bg-secondary"
          onClick={(e) => handleIncrement(e, 100)}
          disabled={disabled || value >= max}
        >
          +100
        </Button>

        {/* Max button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-7 flex-1 text-xs font-medium gap-1",
            "border-amber-500/30 text-amber-600 dark:text-amber-400",
            "hover:bg-amber-500/10 hover:border-amber-500/50"
          )}
          onClick={handleSetMax}
          disabled={disabled || value >= max}
        >
          <ChevronsUp className="h-3 w-3" />
          {translations.max}
        </Button>
      </div>

      {/* Available stock indicator */}
      <div className="text-center text-[10px] text-muted-foreground">
        {translations.available}: <span className="font-medium tabular-nums">{max}</span>
      </div>
    </div>
  );
}
