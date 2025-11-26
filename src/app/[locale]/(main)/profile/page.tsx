import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, Building, MapPin, CreditCard } from "lucide-react";

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

  // Mock profile data - will be replaced with Zoho data
  const profile = {
    name: session.user.name || "Customer",
    email: session.user.email || "",
    phone: "+964 750 123 4567",
    company: "ABC Trading Co.",
    priceList: "Wholesale Price List",
    currency: session.user.currencyCode || "IQD",
    paymentTerms: "Net 30",
    billingAddress: {
      address: "123 Main Street",
      city: "Baghdad",
      country: "Iraq",
    },
    shippingAddress: {
      address: "456 Industrial Area",
      city: "Baghdad",
      country: "Iraq",
    },
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>

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
              <p>{profile.billingAddress.address}</p>
              <p>
                {profile.billingAddress.city}, {profile.billingAddress.country}
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
              <p>{profile.shippingAddress.address}</p>
              <p>
                {profile.shippingAddress.city},{" "}
                {profile.shippingAddress.country}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
