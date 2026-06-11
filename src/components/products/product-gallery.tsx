"use client";

/**
 * ProductGallery — rich customer-facing media display.
 * 
 * Features:
 * - Hero image (large) with thumbnail strip
 * - Lightbox modal: keyboard nav (ESC/arrows), click-outside dismiss
 * - Mobile swipe (touch events)
 * - Datasheet section (PDFs separate from images)
 * - Share button per image (WhatsApp deep link)
 * - Falls back gracefully to product.image_url if no media
 * - Lazy loading + blur placeholder
 *
 * Created: 2026-05-10 (Phase 8)
 */
import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, FileText, Share2, ZoomIn, Download, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaItem {
  id: number;
  url: string;
  thumbnail_url?: string;
  media_type: string;
  category?: string;
  name: string;
  sequence: number;
  mime_type?: string;
  file_size_kb?: number;
  // PIM v1 canonical
  usage?: string;
  visibility?: string;
  asset_type?: string;
  is_main?: boolean;
}

interface ProductGalleryProps {
  productId: string;
  productName: string;
  fallbackImageUrl?: string | null;
  className?: string;
}

export function ProductGallery({
  productId,
  productName,
  fallbackImageUrl,
  className,
}: ProductGalleryProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStart = useRef<number | null>(null);

  // Fetch media (reusable so we can re-run on focus/visibility for fresh image state).
  const fetchMedia = useCallback(async () => {
    try {
      const r = await fetch(`/api/products/${productId}/media`, { cache: "no-store" });
      const data = await r.json();
      if (data.success && Array.isArray(data.media)) setMedia(data.media);
    } catch {
      /* non-fatal */
    } finally {
      setLoaded(true);
    }
  }, [productId]);

  // Fetch on mount.
  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  // Step 3: revalidate product media when the user returns to the tab/window, so
  // set-main/unset-main/delete reflect WITHOUT a manual reload. Debounced + page-scoped:
  // fires only on transition to visible/focus, and at most once per 1.5s.
  useEffect(() => {
    let last = 0;
    const revalidate = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - last < 1500) return;
      last = now;
      fetchMedia();
    };
    document.addEventListener("visibilitychange", revalidate);
    window.addEventListener("focus", revalidate);
    return () => {
      document.removeEventListener("visibilitychange", revalidate);
      window.removeEventListener("focus", revalidate);
    };
  }, [fetchMedia]);

  // Keyboard navigation in lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowRight") setActiveIdx((i) => (i + 1) % displayImages.length);
      if (e.key === "ArrowLeft") setActiveIdx((i) => (i - 1 + displayImages.length) % displayImages.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxOpen, media]);

  // Helpers — guard against Odoo serializing empty fields as boolean false
  // (mime_type can be false, not a string; optional chaining does NOT guard false).
  const mimeIncludes = (m: MediaItem, needle: string) =>
    typeof m.mime_type === "string" && m.mime_type.includes(needle);
  const isVideo = (m: MediaItem) =>
    m.media_type === "video" ||
    m.asset_type === "video" ||
    (typeof m.url === "string" && /youtu\.be|youtube|vimeo|\.mp4($|\?)/i.test(m.url));

  // Split media by type — canonical usage with legacy fallback.
  // Images = NOT datasheet/manual/pdf AND NOT video (videos are not <Image>-renderable).
  const allImages = media.filter((m) => {
    if (isVideo(m)) return false;
    const usage = m.usage || (m.media_type === "datasheet" ? "datasheet" : "gallery");
    return usage !== "datasheet" && usage !== "manual" && !mimeIncludes(m, "pdf");
  });
  const datasheets = media.filter((m) => {
    if (isVideo(m)) return false;
    const usage = m.usage || (m.media_type === "datasheet" ? "datasheet" : "gallery");
    return usage === "datasheet" || usage === "manual" || mimeIncludes(m, "pdf");
  });
  const videos = media.filter(isVideo);
  // Gallery = non-social images; Social = social_media (separate section)
  const galleryImages = allImages
    .filter((m) => (m.usage || m.category) !== "social" && m.category !== "social_media")
    // Main/hero image first, then by sequence (sequences are often equal → stable by id)
    .sort((a, b) => {
      const am = (a as any).is_main === true ? 0 : 1;
      const bm = (b as any).is_main === true ? 0 : 1;
      if (am !== bm) return am - bm;
      const aseq = a.sequence ?? 99, bseq = b.sequence ?? 99;
      if (aseq !== bseq) return aseq - bseq;
      return (a.id ?? 0) - (b.id ?? 0);
    });
  const socialImages = allImages.filter((m) => m.usage === "social" || m.category === "social_media");

  // Convert a YouTube/Vimeo watch URL into an embeddable player URL (inline, not a popup).
  const toEmbedUrl = (u: string): { embed: string | null; thumb: string | null } => {
    if (typeof u !== "string" || !u) return { embed: null, thumb: null };
    const yt = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/i);
    if (yt) return { embed: `https://www.youtube.com/embed/${yt[1]}`, thumb: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg` };
    const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    if (vm) return { embed: `https://player.vimeo.com/video/${vm[1]}`, thumb: null };
    if (/\.mp4($|\?)/i.test(u)) return { embed: u, thumb: null }; // direct file → <video>
    return { embed: null, thumb: null };
  };

  // Build display list: images first (hero first), then videos as playable entries.
  const imageEntries = galleryImages.map(m => ({
    src: m.url, thumb: m.thumbnail_url || m.url, alt: m.name, id: m.id, mediaUrl: m.url,
    isVid: false as const, embed: null as string | null, isMp4: false,
  }));
  const videoEntries = videos.map(m => {
    const { embed, thumb } = toEmbedUrl(m.url);
    return {
      src: thumb || "", thumb: thumb || "", alt: m.name || productName, id: m.id, mediaUrl: m.url,
      isVid: true as const, embed, isMp4: typeof m.url === "string" && /\.mp4($|\?)/i.test(m.url),
    };
  }).filter(v => v.embed || v.isMp4);
  const displayImages = imageEntries.length > 0 || videoEntries.length > 0
    ? [...imageEntries, ...videoEntries]
    : fallbackImageUrl
    ? [{ src: fallbackImageUrl, thumb: fallbackImageUrl, alt: productName, id: -1, mediaUrl: fallbackImageUrl, isVid: false as const, embed: null as string | null, isMp4: false }]
    : [];

  const hasContent = displayImages.length > 0 || datasheets.length > 0 || socialImages.length > 0;
  const currentImage = displayImages[activeIdx];

  // Touch swipe handlers
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(dx) > 60) {
      if (dx < 0) setActiveIdx((i) => (i + 1) % displayImages.length);
      else setActiveIdx((i) => (i - 1 + displayImages.length) % displayImages.length);
    }
    touchStart.current = null;
  };

  // WhatsApp share
  const shareToWhatsApp = useCallback(
    (mediaUrl: string) => {
      const text = `${productName}\n${mediaUrl}`;
      const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(wa, "_blank", "noopener,noreferrer");
    },
    [productName]
  );

  // Branded placeholder when no media is available
  if (!hasContent) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="relative aspect-square overflow-hidden rounded-2xl border bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
          {/* TSH branded placeholder */}
          <div className="flex flex-col items-center gap-3 text-muted-foreground/60">
            <div className="w-20 h-20 rounded-2xl bg-muted/80 flex items-center justify-center border border-border/50">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </div>
            <span className="text-xs font-medium tracking-wide">TSH</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Hero Image with Thumbnails */}
      {displayImages.length > 0 && (
        <div className="space-y-3">
          {/* Main hero — inline video player for video entries, image otherwise */}
          <div
            className={cn(
              "group relative aspect-square overflow-hidden rounded-2xl border bg-gradient-to-br from-muted/50 to-muted",
              currentImage.isVid ? "" : "cursor-zoom-in"
            )}
            onClick={() => { if (!currentImage.isVid) setLightboxOpen(true); }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {currentImage.isVid && currentImage.embed && !currentImage.isMp4 ? (
              <iframe
                src={currentImage.embed}
                title={currentImage.alt}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : currentImage.isVid && currentImage.isMp4 ? (
              <video src={currentImage.mediaUrl} controls className="absolute inset-0 w-full h-full object-contain" />
            ) : (
            <Image
              src={currentImage.src}
              alt={currentImage.alt}
              fill
              className="object-contain transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority={activeIdx === 0}
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                // Retry once (cache-busted) before falling back — transient gateway
                // 404s under cold load recover on the second attempt.
                if (!target.dataset.retried) {
                  target.dataset.retried = "1";
                  const u = currentImage.src;
                  setTimeout(() => {
                    target.src = `${u}${u.includes("?") ? "&" : "?"}r=${Date.now()}`;
                  }, 600);
                  return;
                }
                target.style.display = 'none';
                // Show fallback in parent container
                const parent = target.closest('.group');
                if (parent) {
                  const fb = parent.querySelector('[data-gallery-fallback]');
                  if (fb) (fb as HTMLElement).style.display = 'flex';
                }
              }}
            />
            )}
            {/* Hidden fallback shown on image error */}
            <div data-gallery-fallback className="absolute inset-0 items-center justify-center hidden">
              <div className="flex flex-col items-center gap-3 text-muted-foreground/60">
                <div className="w-20 h-20 rounded-2xl bg-muted/80 flex items-center justify-center border border-border/50">
                  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                </div>
                <span className="text-xs font-medium tracking-wide">TSH</span>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            {!currentImage.isVid && (
              <button
                type="button"
                className="absolute right-3 top-3 p-2 rounded-full bg-white/90 backdrop-blur shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Zoom image"
              >
                <ZoomIn className="h-4 w-4 text-gray-700" />
              </button>
            )}
            {displayImages.length > 1 && (
              <div dir="ltr" className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-black/60 text-white text-xs">
                {activeIdx + 1} / {displayImages.length}
              </div>
            )}
          </div>

          {/* Thumbnails strip */}
          {displayImages.length > 1 && (
            <div dir="ltr" className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {displayImages.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveIdx(idx)}
                  className={cn(
                    "relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all",
                    idx === activeIdx
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-transparent hover:border-muted-foreground/30 opacity-70 hover:opacity-100"
                  )}
                >
                  {img.isVid ? (
                    img.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.thumb} alt={img.alt} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="absolute inset-0 bg-black/70" />
                    )
                  ) : (
                    <Image
                      src={img.thumb}
                      alt={img.alt}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  )}
                  {img.isVid && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-black/60 backdrop-blur">
                        <Play className="h-3.5 w-3.5 text-white fill-white ml-0.5" />
                      </span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Datasheets / Documents */}
      {(datasheets.length > 0 || socialImages.length > 0) && (
        <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
          <h4 className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Datasheets &amp; Documents
          </h4>
          <div className="space-y-1.5">
            {datasheets.map((ds) => (
              <a
                key={ds.id}
                href={ds.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border hover:border-primary/50 hover:bg-primary/5 transition group"
              >
                <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-sm font-medium truncate flex-1">{ds.name}</span>
                {ds.file_size_kb && (
                  <span className="text-xs text-muted-foreground">{ds.file_size_kb} KB</span>
                )}
                <Download className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition" />
              </a>
            ))}
            {socialImages.map((m) => (
              <a
                key={m.id}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border hover:border-primary/50 hover:bg-primary/5 transition group"
              >
                <ZoomIn className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-sm font-medium truncate flex-1">
                  {m.name.includes("story") ? "صورة ستوري (9:16)" : "صورة منشور (Instagram)"}
                </span>
                {m.file_size_kb && (
                  <span className="text-xs text-muted-foreground">{m.file_size_kb} KB</span>
                )}
                <Download className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Quick Share Bar (mobile-friendly, only if real media) */}
      {galleryImages.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shareToWhatsApp(currentImage.mediaUrl)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition"
          >
            <Share2 className="h-4 w-4" />
            Share via WhatsApp
          </button>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxOpen && currentImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white z-10"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>

          {displayImages.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIdx((i) => (i - 1 + displayImages.length) % displayImages.length);
                }}
                aria-label="Previous"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIdx((i) => (i + 1) % displayImages.length);
                }}
                aria-label="Next"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <div
            className="relative w-full h-full max-w-5xl max-h-[85vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {currentImage.isVid && currentImage.embed && !currentImage.isMp4 ? (
              <iframe
                src={currentImage.embed}
                title={currentImage.alt}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : currentImage.isVid && currentImage.isMp4 ? (
              <video src={currentImage.mediaUrl} controls className="w-full h-full object-contain" />
            ) : (
              <Image
                src={currentImage.src}
                alt={currentImage.alt}
                fill
                className="object-contain"
                sizes="(max-width: 1280px) 100vw, 1280px"
                priority
              />
            )}
          </div>

          <div dir="ltr" className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-sm">
            {activeIdx + 1} / {displayImages.length}
          </div>
        </div>
      )}
    </div>
  );
}
