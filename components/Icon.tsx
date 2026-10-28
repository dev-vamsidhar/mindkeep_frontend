export default function Icon({ n, className = "", fill = false }: { n: string; className?: string; fill?: boolean }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined}>
      {n}
    </span>
  );
}
