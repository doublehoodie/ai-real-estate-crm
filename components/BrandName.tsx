/**
 * Brand wordmark — Futura Medium with safe fallbacks. Use only for the literal product name, not general UI.
 */
export function BrandName({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-[Futura,"Futura_PT",ui-sans-serif,sans-serif] font-medium tracking-tight ${className}`.trim()}
    >
      GrassLeads
    </span>
  );
}
