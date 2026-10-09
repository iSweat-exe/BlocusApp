"use client";

import { useState } from "react";
import Image from "next/image";

const BG_IMAGES = ["/images/blocus-bg-1.jpg", "/images/blocus-bg-2.jpg", "/images/blocus-bg-3.jpg"];

/** Background image overlay for the login screen. Picks a random image on mount. */
export function LoginBackground() {
  const [selectedIndex] = useState(() => Math.floor(Math.random() * BG_IMAGES.length));

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-[50vh] overflow-hidden"
    >
      {BG_IMAGES.map((src, index) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          sizes="100vw"
          quality={60}
          priority
          className={`object-cover object-bottom transition-opacity duration-500 ${
            index === selectedIndex ? "opacity-35" : "opacity-0"
          }`}
        />
      ))}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "linear-gradient(to top, transparent 0%, var(--background) 85%)",
        }}
      />
    </div>
  );
}
