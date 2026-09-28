"use client";
import {
  useId,
  useRef,
  useLayoutEffect,
  useState,
  cloneElement,
  isValidElement,
  type ReactNode,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
export function HoverPreview({
  children,
  title,
  lines,
}: {
  children: ReactNode;
  title: string;
  lines: string[];
}) {
  const id = useId();
  const card = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (!point || !card.current) return;
    const y = Math.max(
      8,
      Math.min(point.y, window.innerHeight - card.current.offsetHeight - 8),
    );
    if (y !== point.y) setPoint({ ...point, y });
  }, [point]);
  return (
    <div
      className="desk-hover-target"
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") {
          const r = e.currentTarget.getBoundingClientRect();
          setPoint({
            x: Math.max(8, Math.min(r.left + 20, window.innerWidth - 328)),
            y:
              r.bottom + 240 < window.innerHeight
                ? r.bottom + 6
                : Math.max(8, r.top - 230),
          });
        }
      }}
      onPointerLeave={() => setPoint(null)}
      onFocus={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setPoint({
          x: Math.max(8, Math.min(r.left + 20, window.innerWidth - 328)),
          y: r.top > 240 ? r.top - 230 : r.bottom + 6,
        });
      }}
      onBlur={() => setPoint(null)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setPoint(null);
      }}
      aria-describedby={point ? id : undefined}
    >
      {isValidElement(children)
        ? cloneElement(
            children as ReactElement<{ "aria-describedby"?: string }>,
            { "aria-describedby": point ? id : undefined },
          )
        : children}
      {point &&
        createPortal(
          <div
            ref={card}
            id={id}
            role="tooltip"
            className="desk-hover-card desk-list-hover"
            style={{ left: point.x, top: point.y }}
          >
            <strong>{title}</strong>
            {lines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
            <small>Click for full evidence</small>
          </div>,
          document.body,
        )}
    </div>
  );
}
