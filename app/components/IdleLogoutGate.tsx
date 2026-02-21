"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Props = {
  warningMs?: number; // wann warnen
  logoutMs?: number;  // wann logout
  redirectTo?: string;
};

export default function IdleLogoutGate({
  warningMs = 9.5 * 60 * 1000, // 9:30
  logoutMs = 10 * 60 * 1000,   // 10:00
  redirectTo = "/login",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  // nur unter /admin aktiv
  const enabled = useMemo(() => pathname?.startsWith("/admin"), [pathname]);

  const [open, setOpen] = useState(false);
  const warnedRef = useRef(false);

  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    warningTimer.current = null;
    logoutTimer.current = null;
  };

  const doLogout = async () => {
    try {
      const supabase = supabaseBrowser();
      await supabase.auth.signOut();
    } finally {
      setOpen(false);
      warnedRef.current = false;
      router.replace(redirectTo);
      router.refresh();
    }
  };

  const schedule = () => {
    clearTimers();
    warnedRef.current = false;
    setOpen(false);

    warningTimer.current = setTimeout(() => {
      warnedRef.current = true;
      setOpen(true);
    }, warningMs);

    logoutTimer.current = setTimeout(() => {
      doLogout();
    }, logoutMs);
  };

  const markActive = () => {
    // wenn modal offen ist und user macht was -> weiter
    if (warnedRef.current) {
      setOpen(false);
      warnedRef.current = false;
    }
    schedule();
  };

  useEffect(() => {
    if (!enabled) return;

    schedule();

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "pointerdown",
    ] as const;

    const onVis = () => {
      if (document.visibilityState === "visible") markActive();
    };

    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));
    document.addEventListener("visibilitychange", onVis);

    return () => {
      clearTimers();
      events.forEach((e) => window.removeEventListener(e, markActive as any));
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="text-lg font-semibold">Bist du noch da?</div>
            <p className="mt-2 text-sm text-gray-600">
              Aus Sicherheitsgründen wirst du gleich automatisch ausgeloggt, wenn keine Aktivität erfolgt.
            </p>

            <div className="mt-5 flex gap-3">
              <button
                className="flex-1 rounded-xl bg-black px-4 py-2 text-white"
                onClick={markActive}
              >
                Weiterarbeiten
              </button>
              <button
                className="rounded-xl border px-4 py-2"
                onClick={doLogout}
              >
                Jetzt abmelden
              </button>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              Diese Warnung erscheint nach ~10 Minuten Inaktivität.
            </p>
          </div>
        </div>
      )}
    </>
  );
}