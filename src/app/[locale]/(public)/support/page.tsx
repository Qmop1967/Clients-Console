import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  MessageCircle,
  HelpCircle,
  FileText,
  ShoppingBag
} from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publicSupport");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function PublicSupportPage() {
  const t = await getTranslations("publicSupport");
  const tCommon = await getTranslations("common");

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-gold/10 via-gold/5 to-transparent py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-display font-bold text-foreground mb-4">
            {t("title")}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Contact Information */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-12">
          {/* Email */}
          <Card className="border-gold/20 hover:border-gold/40 transition-colors">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="h-6 w-6 text-gold" />
              </div>
              <h3 className="font-semibold mb-2">{t("contact.email.title")}</h3>
              <a
                href="mailto:support@tsh.sale"
                className="text-gold hover:underline"
              >
                support@tsh.sale
              </a>
            </CardContent>
          </Card>

          {/* Phone */}
          <Card className="border-gold/20 hover:border-gold/40 transition-colors">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="h-6 w-6 text-gold" />
              </div>
              <h3 className="font-semibold mb-2">{t("contact.phone.title")}</h3>
              <a
                href="tel:+9647700000000"
                className="text-gold hover:underline"
                dir="ltr"
              >
                +964 770 000 0000
              </a>
            </CardContent>
          </Card>

          {/* Address */}
          <Card className="border-gold/20 hover:border-gold/40 transition-colors">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-6 w-6 text-gold" />
              </div>
              <h3 className="font-semibold mb-2">{t("contact.address.title")}</h3>
              <p className="text-muted-foreground text-sm">
                {t("contact.address.value")}
              </p>
            </CardContent>
          </Card>

          {/* Hours */}
          <Card className="border-gold/20 hover:border-gold/40 transition-colors">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="h-6 w-6 text-gold" />
              </div>
              <h3 className="font-semibold mb-2">{t("contact.hours.title")}</h3>
              <p className="text-muted-foreground text-sm">
                {t("contact.hours.value")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-gold" />
              {t("faq.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* FAQ Item 1 */}
            <div className="border-b border-border pb-4">
              <h4 className="font-semibold mb-2">{t("faq.q1.question")}</h4>
              <p className="text-muted-foreground text-sm">{t("faq.q1.answer")}</p>
            </div>

            {/* FAQ Item 2 */}
            <div className="border-b border-border pb-4">
              <h4 className="font-semibold mb-2">{t("faq.q2.question")}</h4>
              <p className="text-muted-foreground text-sm">{t("faq.q2.answer")}</p>
            </div>

            {/* FAQ Item 3 */}
            <div className="border-b border-border pb-4">
              <h4 className="font-semibold mb-2">{t("faq.q3.question")}</h4>
              <p className="text-muted-foreground text-sm">{t("faq.q3.answer")}</p>
            </div>

            {/* FAQ Item 4 */}
            <div>
              <h4 className="font-semibold mb-2">{t("faq.q4.question")}</h4>
              <p className="text-muted-foreground text-sm">{t("faq.q4.answer")}</p>
            </div>
          </CardContent>
        </Card>

        {/* Services Section */}
        <div className="grid gap-6 md:grid-cols-3 mb-12">
          {/* Orders Support */}
          <Card className="border-gold/20">
            <CardContent className="p-6">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
                <ShoppingBag className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold mb-2">{t("services.orders.title")}</h3>
              <p className="text-muted-foreground text-sm">
                {t("services.orders.description")}
              </p>
            </CardContent>
          </Card>

          {/* Technical Support */}
          <Card className="border-gold/20">
            <CardContent className="p-6">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-4">
                <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold mb-2">{t("services.technical.title")}</h3>
              <p className="text-muted-foreground text-sm">
                {t("services.technical.description")}
              </p>
            </CardContent>
          </Card>

          {/* Invoices Support */}
          <Card className="border-gold/20">
            <CardContent className="p-6">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4">
                <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold mb-2">{t("services.invoices.title")}</h3>
              <p className="text-muted-foreground text-sm">
                {t("services.invoices.description")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Company Info */}
        <Card className="bg-muted/50">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              {t("company.name")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("company.tagline")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
