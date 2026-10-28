"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Space anywhere (outside inputs/buttons/links) jumps to the review queue.
export default function SpaceShortcut({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || (e.target as HTMLElement).closest("input,textarea,button,a")) return;
      e.preventDefault();
      router.push(to);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, to]);
  return null;
}
