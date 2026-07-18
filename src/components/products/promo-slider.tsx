"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

interface PromoSlide {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  cta_label?: string;
  cta_href?: string;
}

/**
 * PromoSlider — admin-managed merchandising band living in the space the old
 * oversized hero used to waste. Slides come from /api/shop/promos (Odoo system
 * parameter `tsh.storefront.promos`), so the business can push quantity deals,
 * new-container arrivals, or announcements WITHOUT a deploy.
 *
 * - Renders nothing while loading / when no active slides (zero layout cost).
 * - Auto-rotates every 6s when more than one slide; swipe/RTL safe (buttons
 *   + dots, no drag dependency); pauses on hover.
 * - Brand: gradient band + faint TSH mark watermark (same mark as header).
 */
export function PromoSlider() {
  const t = useTranslations("products");
  const [slides, setSlides] = useState<PromoSlide[]>([]);
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hoverRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/shop/promos")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.slides?.length) setSlides(data.slides);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const advance = useCallback(() => {
    if (!hoverRef.current) setIndex((i) => (i + 1) % Math.max(slides.length, 1));
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    timerRef.current = setInterval(advance, 6000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [slides.length, advance]);

  if (slides.length === 0) return null;

  const slide = slides[Math.min(index, slides.length - 1)];

  const inner = (
    <div
      className="relative flex min-h-[104px] items-center gap-4 overflow-hidden rounded-2xl border border-primary/20 px-5 py-4 sm:px-7"
      style={{
        background:
          "linear-gradient(120deg, hsl(206 85% 22%) 0%, hsl(208 70% 15%) 55%, hsl(210 60% 10%) 100%)",
      }}
      onMouseEnter={() => (hoverRef.current = true)}
      onMouseLeave={() => (hoverRef.current = false)}
      role="region"
      aria-label={t("promoAria")}
    >
      {/* Faint brand watermark on the start-opposite side */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/tsh-mark.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute end-5 top-1/2 h-14 w-auto -translate-y-1/2 opacity-25 sm:h-16"
        draggable={false}
      />

      <div className="relative min-w-0 flex-1 text-white">
        {slide.badge && (
          <span className="mb-1.5 inline-block rounded-md bg-white/15 px-2.5 py-0.5 text-[11px] font-bold">
            {slide.badge}
          </span>
        )}
        <p className="text-base font-extrabold leading-snug sm:text-lg">{slide.title}</p>
        {slide.subtitle && (
          <p className="mt-0.5 line-clamp-2 text-[12.5px] text-white/70 sm:text-sm">{slide.subtitle}</p>
        )}
      </div>

      {slide.cta_label && slide.cta_href && (
        <span className="relative hidden shrink-0 rounded-xl bg-white px-4 py-2 text-[13px] font-extrabold text-[hsl(206_85%_22%)] shadow-sm transition-transform group-hover:scale-[1.03] sm:block">
          {slide.cta_label}
        </span>
      )}

      {/* Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-2.5 start-5 flex items-center gap-1.5" aria-hidden="true">
          {slides.map((s, i) => (
            <button
              key={s.id || i}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIndex(i);
              }}
              className={cn(
                "h-1 rounded-full transition-all",
                i === index ? "w-6 bg-white" : "w-3 bg-white/35 hover:bg-white/60"
              )}
              aria-label={`${i + 1}/${slides.length}`}
            />
          ))}
        </div>
      )}
    </div>
  );

  // Whole band is tappable when a CTA target exists
  if (slide.cta_href) {
    const href = slide.cta_href;
    const isAnchor = href.startsWith("#");
    if (isAnchor) {
      return (
        <button
          type="button"
          className="group block w-full text-start"
          onClick={() => document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          {inner}
        </button>
      );
    }
    return (
      <Link prefetch={false} href={href} className="group block">
        {inner}
      </Link>
    );
  }

  return inner;
}
