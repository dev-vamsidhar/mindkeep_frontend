"use client";
import Icon from "./Icon";

export default function ThemeToggle() {
  const toggle = () => {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.theme = dark ? "dark" : "light";
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
    >
      {/* both icons render; CSS picks one, so no hydration mismatch */}
      <Icon n="dark_mode" className="text-[20px] dark:hidden" />
      <Icon n="light_mode" className="text-[20px] hidden dark:inline-block" />
    </button>
  );
}
