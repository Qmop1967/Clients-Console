import type { Metadata } from 'next';
import Image from 'next/image';
import { Boxes, Cable, CircleCheck, MapPin, PlugZap, Store } from 'lucide-react';
import { MarketingShell } from '@/components/marketing/marketing-chrome';
import {
  AcAdapterCampaignActions,
  AcAdapterCampaignView,
} from '@/components/marketing/ac-adapter-campaign-actions';
import { COMPANY, toMarketingLocale } from '@/lib/marketing/company';

interface Props {
  params: Promise<{ locale: string }>;
}

const PRODUCTS = [
  {
    sku: 'TSH-2349',
    en: 'Lenovo-style Type-C adapter',
    ar: 'شاحن Type-C لأجهزة Lenovo المتوافقة',
    specification: 'Type-C',
  },
  {
    sku: 'TSH-2342',
    en: 'Dell-style 90W adapter',
    ar: 'شاحن 90W لأجهزة Dell المتوافقة',
    specification: '19.5V · 4.62A · 7.4 × 5.0 mm',
  },
  {
    sku: 'TSH-2348',
    en: 'Lenovo-style 65W adapter',
    ar: 'شاحن 65W لأجهزة Lenovo المتوافقة',
    specification: '20V · 3.25A · 4.0 × 1.7 mm',
  },
  {
    sku: 'TSH-2346',
    en: 'HP-style blue-tip 90W adapter',
    ar: 'شاحن HP برأس أزرق 90W للأجهزة المتوافقة',
    specification: '19.5V · 4.62A · 4.5 × 3.0 mm',
  },
  {
    sku: 'TSH-2345',
    en: 'HP-style 90W adapter',
    ar: 'شاحن 90W لأجهزة HP المتوافقة',
    specification: '19V · 4.74A · 7.4 × 5.0 mm',
  },
] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = toMarketingLocale(locale) === 'ar';
  return {
    title: isAr
      ? 'شواحن لابتوب PowerPluse بالجملة في العراق'
      : 'PowerPluse Laptop AC Adapters Wholesale in Iraq',
    description: isAr
      ? 'شواحن لابتوب PowerPluse بالجملة للتجّار والمكاتب الفنية في العراق. خيارات Type-C و65W و90W ومقاسات رؤوس متعددة، مع مخزون جاهز في بغداد.'
      : 'PowerPluse laptop AC adapters for Iraqi dealers and technical offices. Type-C, 65W and 90W options with multiple connector sizes and ready stock in Baghdad.',
    alternates: {
      canonical: `${COMPANY.website}/${locale}/wholesale/ac-adapters`,
    },
  };
}

function CollectionJsonLd({ locale }: { locale: string }) {
  const isAr = toMarketingLocale(locale) === 'ar';
  const data = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: isAr ? 'شواحن لابتوب PowerPluse بالجملة' : 'PowerPluse Laptop AC Adapters Wholesale',
    url: `${COMPANY.website}/${locale}/wholesale/ac-adapters`,
    isPartOf: {
      '@type': 'WebSite',
      name: COMPANY.legalNameEn,
      url: COMPANY.website,
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: PRODUCTS.map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'Product',
          name: isAr ? product.ar : product.en,
          sku: product.sku,
          brand: { '@type': 'Brand', name: 'PowerPluse' },
          category: isAr ? 'شواحن لابتوب' : 'Laptop AC adapters',
        },
      })),
    },
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

export default async function AcAdaptersWholesalePage({ params }: Props) {
  const { locale } = await params;
  const isAr = toMarketingLocale(locale) === 'ar';

  const benefits = [
    {
      icon: Boxes,
      ar: 'مخزون فعلي جاهز',
      en: 'Ready physical stock',
      arD: 'كميات متاحة للتوريد من مخزننا في بغداد للتجّار والمكاتب الفنية.',
      enD: 'Quantities ready to supply from our Baghdad warehouse to dealers and technical offices.',
    },
    {
      icon: PlugZap,
      ar: 'مقاسات متعددة',
      en: 'Multiple connector types',
      arD: 'خيارات Type-C ورؤوس دائرية شائعة لتغطية موديلات لابتوب مختلفة.',
      enD: 'Type-C and common round connector options for different laptop families.',
    },
    {
      icon: Store,
      ar: 'تسعير تجاري',
      en: 'Trade-account pricing',
      arD: 'السعر يُقدّم حسب حساب التاجر والكمية، من دون نشر أسعار الجملة التعاقدية.',
      enD: 'Quotes reflect the trade account and quantity; contractual wholesale prices stay private.',
    },
    {
      icon: MapPin,
      ar: 'توريد داخل العراق',
      en: 'Supply across Iraq',
      arD: 'خدمة شبكة التجّار والشركاء من بغداد إلى مختلف المحافظات.',
      enD: 'Serving dealers and trade partners from Baghdad across Iraqi provinces.',
    },
  ];

  return (
    <MarketingShell locale={locale}>
      <CollectionJsonLd locale={locale} />
      <AcAdapterCampaignView />

      <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,32rem)] lg:gap-12">
        <div>
          <span className="inline-flex items-center rounded-full bg-gold-subtle px-3 py-1 text-xs font-semibold text-gold">
            {isAr ? 'عرض مخصّص لتجّار الجملة' : 'For wholesale trade partners'}
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold text-foreground sm:text-5xl">
            {isAr ? 'شواحن لابتوب PowerPluse بالجملة' : 'PowerPluse Laptop AC Adapters Wholesale'}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted-foreground">
            {isAr
              ? 'خيارات Type-C و65W و90W مع مقاسات رؤوس متعددة، وكميات جاهزة لتجار الحاسبات والمكاتب الفنية في العراق. اطلب عرضاً حسب الموديلات والكميات التي تحتاجها.'
              : 'Type-C, 65W and 90W options with multiple connector sizes and quantities ready for Iraqi computer dealers and technical offices. Request a quote for the models and quantities you need.'}
          </p>
          <div className="mt-7">
            <AcAdapterCampaignActions locale={locale} />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {isAr
              ? 'نبيع بالجملة فقط. الأسعار حسب حسابك التجاري والكمية، ولا تُعرض أسعار الجملة التعاقدية للعامة.'
              : 'Wholesale only. Pricing depends on your trade account and quantity; contractual wholesale prices are not displayed publicly.'}
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-[#071425] shadow-2xl">
          <Image
            src="/marketing/ac-adapters-tiktok-hero.webp"
            alt={
              isAr
                ? 'ثلاثة شواحن لابتوب بمقابس Type-C ودائرية مختلفة'
                : 'Three laptop AC adapters with Type-C and round connector options'
            }
            width={900}
            height={1599}
            priority
            sizes="(max-width: 1024px) 100vw, 32rem"
            className="h-auto w-full object-cover"
          />
        </div>
      </section>

      <section className="mt-14" aria-labelledby="available-models">
        <div className="flex items-center gap-3">
          <Cable className="size-6 text-gold" aria-hidden />
          <h2 id="available-models" className="font-display text-2xl font-bold text-foreground">
            {isAr ? 'موديلات مختارة متوفّرة' : 'Selected available models'}
          </h2>
        </div>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          {isAr
            ? 'هذه عيّنة من المقاسات الأعلى توفّراً لدينا. أكّد رقم الفولت والأمبير والواط وقياس الرأس قبل الطلب.'
            : 'A sample of our best-stocked connector options. Confirm voltage, current, wattage and connector size before ordering.'}
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {PRODUCTS.map((product) => (
            <article key={product.sku} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-gold-subtle text-gold">
                  <CircleCheck className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold text-foreground">
                    {isAr ? product.ar : product.en}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
                    {product.specification}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-gold" dir="ltr">
                    {product.sku}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="mt-14 grid gap-4 sm:grid-cols-2"
        aria-label={isAr ? 'مزايا التوريد' : 'Supply benefits'}
      >
        {benefits.map((benefit) => (
          <article
            key={benefit.en}
            className="flex gap-4 rounded-xl border border-border bg-card p-5"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-gold-subtle text-gold">
              <benefit.icon className="size-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-semibold text-foreground">{isAr ? benefit.ar : benefit.en}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {isAr ? benefit.arD : benefit.enD}
              </p>
            </div>
          </article>
        ))}
      </section>

      <aside className="mt-12 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold text-foreground">
          {isAr ? 'تأكّد من المطابقة قبل الطلب' : 'Confirm compatibility before ordering'}
        </h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
          {isAr
            ? 'اسم الشركة المصنّعة وحده لا يكفي. أرسل لفريق المبيعات صورة ملصق الشاحن القديم وقياس الرأس، وتأكد من تطابق الفولت، وأن الأمبير والواط مناسبان للجهاز. هذا يقلل أخطاء المطابقة والمرتجعات.'
            : 'The laptop brand alone is not enough. Send sales a photo of the old adapter label and connector size, confirm the voltage matches, and ensure current and wattage suit the device. This reduces compatibility errors and returns.'}
        </p>
      </aside>

      <section
        className="mt-12 rounded-2xl border border-border bg-muted/40 p-6 sm:p-8"
        aria-labelledby="quote"
      >
        <h2 id="quote" className="font-display text-2xl font-bold text-foreground">
          {isAr ? 'اطلب عرض الجملة' : 'Request a wholesale quote'}
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {isAr
            ? 'اذكر اسم نشاطك التجاري والمحافظة والموديلات والكميات المطلوبة، وسيتواصل معك فريق المبيعات.'
            : 'Tell us your business name, province, required models and quantities, and our sales team will contact you.'}
        </p>
        <div className="mt-6">
          <AcAdapterCampaignActions locale={locale} />
        </div>
      </section>
    </MarketingShell>
  );
}
