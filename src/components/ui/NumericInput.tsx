"use client";

import { useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

/** 1000 -> "1.000" (Indonesian thousands separator). */
function formatThousands(raw: string) {
  return raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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
 * Digits-only text input shared by every integer field in the admin UI.
 * Renders `type="text"` (never `type="number"`) so letters, `e`, `+`, `-`,
 * decimal points, and negative values can never be typed or pasted in.
 *
 * Displays Indonesian thousands separators as you type (1000 -> 1.000) while
 * still submitting the raw digits through a hidden input, because
 * `Number("1.000")` is `1` in JavaScript - formatting must never leak into
 * the value read by the server action.
 *
 * Works both uncontrolled (with `name` + `defaultValue`, for plain
 * FormData submits) and controlled (with `value` + `onValueChange`).
 */
export function NumericInput({
  name,
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
  const raw = value !== undefined ? digitsOnly(String(value)) : internal;

  function commit(next: string) {
    const clean = digitsOnly(next);
    if (value === undefined) setInternal(clean);
    onValueChange?.(clean);
  }

  return (
    <>
      {name ? <input type="hidden" name={name} value={raw} /> : null}
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        {...props}
        value={formatThousands(raw)}
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
    </>
  );
}
