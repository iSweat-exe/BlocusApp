"use client";

import { useEffect, useState } from "react";

const LOCAL_BG_IMAGES = [
  "/images/blocus-bg-1.jpg",
  "/images/blocus-bg-2.jpg",
  "/images/blocus-bg-3.jpg",
];

export function LoginBackground() {
  const [bgImg, setBgImg] = useState<string>(LOCAL_BG_IMAGES[0]!);

  useEffect(() => {
    const randomImg =
      LOCAL_BG_IMAGES[Math.floor(Math.random() * LOCAL_BG_IMAGES.length)] ?? LOCAL_BG_IMAGES[0]!;
    const timer = setTimeout(() => setBgImg(randomImg), 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-[55vh] overflow-hidden"
    >
      <div
        className="h-full w-full bg-cover bg-bottom opacity-45 transition-opacity duration-500"
        style={{ backgroundImage: `url('${bgImg}')` }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(to top, rgba(0, 0, 0, 0) 0%, var(--background) 80%)",
        }}
      />
    </div>
  );
}
