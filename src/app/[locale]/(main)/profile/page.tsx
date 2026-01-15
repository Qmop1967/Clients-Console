import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, Building, MapPin, CreditCard, AlertCircle } from "lucide-react";
import { getZohoCustomer } from "@/lib/zoho/customers";
import { getPriceList } from "@/lib/zoho/price-lists";

// ISR: Revalidate every 5 minutes (profile data changes less frequently)
export const revalidate = 300;

export async function generateMetadata() {
  const t = await getTranslations("profile");
  return {
    title: t("title"),
  };
}

export default async function ProfilePage() {
  const session = await auth();
  const t = await getTranslations("profile");

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch customer and price list in parallel for better performance
  // Use session.user.priceListId (already stored) to avoid waiting for customer fetch
  const [zohoCustomer, priceList] = await Promise.all([
    session.user.zohoContactId
      ? getZohoCustomer(session.user.zohoContactId)
      : Promise.resolve(null),
    session.user.priceListId
      ? getPriceList(session.user.priceListId)
      : Promise.resolve(null),
  ]);

  // Build profile from Zoho data or fallback to session data
  const profile = {
    name: zohoCustomer?.contact_name || session.user.name || "Customer",
    email: zohoCustomer?.email || session.user.email || "",
    phone: zohoCustomer?.phone || zohoCustomer?.mobile || "Not provided",
    company: zohoCustomer?.company_name || "Not provided",
    priceList: priceList?.name || "Standard",
    currency: zohoCustomer?.currency_code || session.user.currencyCode || "IQD",
    paymentTerms: zohoCustomer?.payment_terms_label || "Net 30",
    billingAddress: zohoCustomer?.billing_address || {
      address: "Not provided",
      city: "",
      country: "",
    },
    shippingAddress: zohoCustomer?.shipping_address || {
      address: "Not provided",
      city: "",
      country: "",
    },
  };

  // Helper to format address
  const formatAddress = (addr: { address?: string; city?: string; state?: string; country?: string; zip?: string }) => {
    const parts = [addr.address, addr.city, addr.state, addr.country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "Not provided";
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>

        {/* Account Not Linked Warning */}
        {!session.user.zohoContactId && (
          <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Account Not Linked
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Your account is not linked to our system. Contact support to link your account.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profile Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary/10 text-primary text-xl">
                  {profile.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-semibold">{profile.name}</h2>
                <p className="text-muted-foreground">{profile.company}</p>
                {session.user.zohoContactId && (
                  <Badge variant="secondary" className="mt-1">
                    Zoho Connected
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t("personalInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">{t("email")}</p>
                <p>{profile.email}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">{t("phone")}</p>
                <p>{profile.phone}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <Building className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">{t("company")}</p>
                <p>{profile.company}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Account Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">{t("priceList")}</p>
              <p>{profile.priceList}</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">{t("currency")}</p>
              <p>{profile.currency}</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">
                {t("paymentTerms")}
              </p>
              <p>{profile.paymentTerms}</p>
            </div>
          </CardContent>
        </Card>

        {/* Addresses */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" />
                {t("billingAddress")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {formatAddress(profile.billingAddress)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" />
                {t("shippingAddress")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {formatAddress(profile.shippingAddress)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
