"use client";

import { useState } from "react";

/**
 * Logo da Zefer. Usa `public/logo.png` se existir; caso contrário, mostra um
 * "Z" dourado como fallback. O logo é renderizado pela altura, preservando a
 * proporção original (lockup em paisagem).
 */
export function LogoBadge({
  height = 36,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  const [erro, setErro] = useState(false);

  if (!erro) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/logo.png"
        alt="Zefer"
        onError={() => setErro(true)}
        className={`w-auto object-contain ${className}`}
        style={{ height }}
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-lg bg-[linear-gradient(135deg,#f3da8b,#d9b75a_45%,#a87c24)] font-serif font-bold text-[#1a1206] shadow-sm ring-1 ring-[#d9b75a]/30"
      style={{ width: height, height, fontSize: height * 0.5 }}
    >
      Z
    </div>
  );
}
