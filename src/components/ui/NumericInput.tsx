"use client";

import { useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

interface NumericInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "type" | "inputMode" | "pattern" | "value" | "defaultValue" | "onChange"
  > {
  name?: string;
  value?: string | number;
  defaultValue?: string | number;
  onValueChange?: (value: string) => void;
  onChange?: InputHTMLAttributes<HTMLInputElement>["onChange"];
}

/**
 * Digits-only text input shared by every numeric field in the admin UI.
 * Renders `type="text"` (never `type="number"`) so letters, `e`, `+`, `-`,
 * decimal points, and negative values can never be typed or pasted in -
 * every keystroke and paste is stripped down to `[0-9]`.
 *
 * Works both uncontrolled (with `name` + `defaultValue`, for plain
 * FormData submits) and controlled (with `value` + `onValueChange`).
 */
export function NumericInput({
  value,
  defaultValue,
  onValueChange,
  onChange,
  className,
  ...props
}: NumericInputProps) {
  const [internal, setInternal] = useState(() =>
    digitsOnly(String(defaultValue ?? "")),
  );
  const shown = value !== undefined ? String(value) : internal;

  function commit(next: string) {
    const clean = digitsOnly(next);
    if (value === undefined) setInternal(clean);
    onValueChange?.(clean);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      {...props}
      value={shown}
      onChange={(event) => {
        commit(event.target.value);
        onChange?.(event);
      }}
      onPaste={(event) => {
        event.preventDefault();
        commit(event.clipboardData.getData("text"));
      }}
      className={cn("outline-none", className)}
    />
  );
}
