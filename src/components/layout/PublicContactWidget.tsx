"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Mail, Phone, Send, X } from "lucide-react";
import { mailtoHref, telHref, whatsappHref } from "@/lib/utils/contact";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M20.52 3.48A11.86 11.86 0 0 0 12.05 0C5.5 0 .17 5.33.17 11.88c0 2.09.55 4.13 1.6 5.93L0 24l6.36-1.67a11.9 11.9 0 0 0 5.69 1.45h.01c6.55 0 11.88-5.33 11.88-11.88 0-3.17-1.24-6.15-3.42-8.42ZM12.06 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.77.99 1.01-3.68-.24-.38a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.46-4.44 9.9-9.86 9.9Zm5.43-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.04-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37s-1.04 1.02-1.04 2.48 1.06 2.88 1.21 3.08c.15.2 2.09 3.2 5.07 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35Z" />
    </svg>
  );
}

export function PublicContactWidget({
  contact,
  raised = false,
}: {
  contact: { phone: string; email: string };
  /** Lifts the bubble above a fixed bottom action bar (booking survey/CTA). */
  raised?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function send() {
    const text = message.trim();
    if (!text) return;
    window.open(
      whatsappHref(contact.phone, text),
      "_blank",
      "noopener,noreferrer",
    );
    setMessage("");
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  return (
    <>
      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Hubungi admin"
          className={`fixed right-4 left-4 z-50 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl sm:left-auto sm:w-96 ${
            raised ? "bottom-40 lg:bottom-24" : "bottom-24"
          }`}
        >
          <div className="flex items-center justify-between gap-3 bg-brand-700 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">Hubungi Admin</p>
              <p className="text-xs text-brand-50">
                Arenan Kalikesek · WhatsApp
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup"
              className="rounded p-1 text-brand-50 transition-colors hover:bg-white/10"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="p-4">
            <label className="block text-xs font-medium text-gray-600">
              Tulis pesan
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
                autoFocus
                placeholder="Halo admin, saya ingin bertanya…"
                className="mt-1 block w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
              />
            </label>
            <p className="mt-1 text-[11px] text-gray-400">
              Enter untuk kirim · Shift+Enter untuk baris baru
            </p>

            <button
              type="button"
              onClick={send}
              disabled={!message.trim()}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="size-4" />
              Kirim via WhatsApp
            </button>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <a
                href={telHref(contact.phone)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <Phone className="size-3.5" />
                Telepon
              </a>
              <a
                href={mailtoHref(contact.email)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <Mail className="size-3.5" />
                Email
              </a>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Hubungi admin via WhatsApp"
        aria-expanded={open}
        className={`fixed right-4 z-50 flex size-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 sm:right-6 sm:size-14 ${
          raised ? "bottom-24 lg:bottom-6" : "bottom-6"
        }`}
      >
        <WhatsAppIcon className="size-8" />
      </button>
    </>
  );
}
