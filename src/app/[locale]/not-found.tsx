import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  const t = useTranslations("common");

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <FileQuestion className="h-8 w-8 text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{t("notFoundTitle")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("notFoundDescription")}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-4">
            <Button variant="outline" asChild className="gap-2">
              <Link href="javascript:history.back()">
                <ArrowLeft className="h-4 w-4" />
                {t("goBack")}
              </Link>
            </Button>
            <Button variant="default" asChild className="gap-2">
              <Link href="/">
                <Home className="h-4 w-4" />
                {t("goHome")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
