"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const DISMISSED_KEY = "lh:ios-install-hint-dismissed";

export function IosInstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const nav = window.navigator as { standalone?: boolean };
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      nav.standalone === true;
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const dismissed = localStorage.getItem(DISMISSED_KEY) === "1";

    if (isIos && !isStandalone && !dismissed) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-lg sm:inset-x-auto sm:right-4 sm:max-w-sm">
      <Share className="size-5 shrink-0 text-primary" />
      <p className="flex-1 text-foreground">
        Para instalar o LumiHunter no seu iPhone: toque em{" "}
        <strong>Compartilhar</strong> e depois em{" "}
        <strong>Adicionar à Tela de Início</strong>.
      </p>
      <button
        type="button"
        aria-label="Fechar aviso"
        onClick={() => {
          localStorage.setItem(DISMISSED_KEY, "1");
          setVisible(false);
        }}
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
