import { notFound } from "next/navigation";
import { getProduct } from "@/lib/odoo/products";

// Public product share page — no auth (allowed in middleware), for WhatsApp/social sharing.
export const revalidate = 120;

const WA = process.env.NEXT_PUBLIC_TSH_WHATSAPP || "";

type Media = {
  id: number;
  x_url: string;
  x_media_type: string;
  x_visibility: string;
  x_is_main?: boolean;
  x_name?: string;
};

async function fetchPublicMedia(
  ppId: string
): Promise<{ images: Media[]; video: Media | null }> {
  try {
    const base = process.env.API_GATEWAY_URL || "http://127.0.0.1:3010";
    const key = process.env.API_KEY || process.env.GATEWAY_API_KEY || "";
    const r = await fetch(`${base}/api/product-media/by-product/${ppId}`, {
      headers: { "x-api-key": key },
      next: { revalidate: 120 },
    });
    if (!r.ok) return { images: [], video: null };
    const d = await r.json();
    const m: Media[] = d.media || d.data?.media || d.data || [];
    const pub = m.filter((x) => x && x.x_visibility === "public" && x.x_url);
    const images = pub
      .filter((x) => x.x_media_type !== "video")
      .sort((a, b) => (b.x_is_main ? 1 : 0) - (a.x_is_main ? 1 : 0));
    const video = pub.find((x) => x.x_media_type === "video") || null;
    return { images, video };
  } catch {
    return { images: [], video: null };
  }
}

function ytEmbed(url: string): string | null {
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/
  );
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale, id } = await params;
  const product = await getProduct(id, locale === "en" ? "en_US" : "ar_001");
  if (!product) return { title: "TSH" };
  const { images } = await fetchPublicMedia(id);
  const img = images[0]?.x_url;
  const title = `${product.name} — TSH`;
  const description = (product.description || product.name).slice(0, 160);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: img ? [{ url: img }] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: img ? [img] : [],
    },
  };
}

export default async function PublicProductPage({ params }: PageProps) {
  const { locale, id } = await params;
  const isAr = locale !== "en";
  const product = await getProduct(id, isAr ? "ar_001" : "en_US");
  if (!product) notFound();
  const { images, video } = await fetchPublicMedia(id);
  const embed = video?.x_url ? ytEmbed(video.x_url) : null;

  const waText = encodeURIComponent(
    (isAr ? "مرحباً، أرغب بالاستفسار عن المنتج: " : "Hello, I'd like to ask about: ") +
      product.name +
      (product.sku ? ` (${product.sku})` : "")
  );
  const waLink = WA ? `https://wa.me/${WA}?text=${waText}` : null;

  const L = isAr
    ? {
        order: "اطلب الآن عبر واتساب",
        contact: "للطلب والأسعار، تواصل مع ممثل المبيعات",
        video: "🎥 فيديو المنتج",
        noimg: "لا توجد صور متاحة حالياً",
      }
    : {
        order: "Order via WhatsApp",
        contact: "For ordering and prices, contact our sales rep",
        video: "🎥 Product video",
        noimg: "No images available yet",
      };

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-6 pb-16">
        <header className="text-center border-b border-slate-800 pb-5 mb-6">
          <div className="text-[13px] font-bold tracking-[3px] text-blue-400">TSH</div>
          <h1 className="text-2xl font-extrabold mt-2 leading-snug">{product.name}</h1>
          {product.alias_name && (
            <p className="text-sm text-slate-400 mt-1">{product.alias_name}</p>
          )}
          {product.sku && (
            <span
              dir="ltr"
              className="inline-block mt-3 text-xs font-bold text-slate-400 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1"
            >
              {product.sku}
            </span>
          )}
        </header>

        {images.length === 0 ? (
          <p className="text-center text-slate-500 py-10">{L.noimg}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {images.map((img, i) => (
              <a
                key={img.id}
                href={img.x_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`block bg-white rounded-2xl overflow-hidden border border-slate-800 ${
                  i === 0 ? "col-span-2" : ""
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.x_url}
                  alt={product.name}
                  loading={i === 0 ? "eager" : "lazy"}
                  className={`w-full object-contain ${i === 0 ? "max-h-[460px]" : "h-52"}`}
                />
              </a>
            ))}
          </div>
        )}

        {embed && (
          <>
            <h2 className="text-base font-extrabold mt-8 mb-3">{L.video}</h2>
            <div
              className="relative w-full overflow-hidden rounded-2xl border border-slate-800"
              style={{ aspectRatio: "16 / 9" }}
            >
              <iframe
                src={embed}
                title={L.video}
                allowFullScreen
                className="absolute inset-0 w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          </>
        )}

        {product.description && (
          <p className="text-sm text-slate-300 leading-relaxed mt-6 whitespace-pre-line">
            {product.description}
          </p>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-slate-400 mb-3">{L.contact}</p>
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-2xl px-8 py-4 text-base"
            >
              {L.order}
            </a>
          )}
        </div>

        <footer className="text-center text-slate-500 text-xs mt-12 pt-5 border-t border-slate-800">
          <a href="https://tsh.sale" className="text-blue-400">
            TSH
          </a>
        </footer>
      </div>
    </div>
  );
}
