"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

// Resize only when the panel changes size. Extra items use pages, never scrollbars.
export function FitList<T>({ items, label, renderItem, className = "" }: { items: T[]; label: string; renderItem: (item: T) => ReactNode; className?: string }) {
  const element = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState(1);
  const [page, setPage] = useState(0);
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      const row = Number.parseFloat(getComputedStyle(node).getPropertyValue("--row-height")) || 72;
      setCapacity(Math.max(1, Math.floor((node.clientHeight - 44) / row)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const pages = Math.max(1, Math.ceil(items.length / capacity));
  const current = Math.min(page, pages - 1);
  return <div ref={element} className={`fit-list ${className}`}>
    <ol className="fit-items">{items.slice(current * capacity, (current + 1) * capacity).map(renderItem)}</ol>
    {pages > 1 && <div className="fit-pagination" aria-label={`${label} pages`}><button type="button" aria-label={`Previous ${label}`} disabled={current === 0} onClick={() => setPage(current - 1)}>←</button><span>{current + 1} / {pages}</span><button type="button" aria-label={`Next ${label}`} disabled={current === pages - 1} onClick={() => setPage(current + 1)}>→</button></div>}
  </div>;
}
