"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Truck, 
  Package, 
  ArrowLeft, 
  Clock, 
  MapPin, 
  DollarSign, 
  CreditCard,
  CheckCircle
} from "lucide-react";

type OrderType = "bulk" | "delivery";

export default function OrderTypePage() {
  const t = useTranslations("orderType");
  const tCommon = useTranslations("common");
  const { locale } = useParams();
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<OrderType | null>(null);

  const orderTypes = [
    {
      type: "bulk" as OrderType,
      title: "طلبية نقليات",
      icon: <Truck className="h-8 w-8" />,
      color: "bg-blue-500 hover:bg-blue-600",
      borderColor: "border-blue-500",
      textColor: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      description: "للكميات الكبيرة والطلبات التجارية",
      features: {
        coverage: "مراكز المدن فقط",
        size: "كميات كبيرة (جملة)",
        cost: "2,000-3,000 د.ع/كارتون",
        payment: "آجل (على رصيدك)",
        speed: "أبطأ"
      }
    },
    {
      type: "delivery" as OrderType,
      title: "طلبية توصيل",
      icon: <Package className="h-8 w-8" />,
      color: "bg-pink-500 hover:bg-pink-600",
      borderColor: "border-pink-500",
      textColor: "text-pink-600",
      bgColor: "bg-pink-50 dark:bg-pink-950/20",
      description: "للطلبات السريعة والمنازل",
      features: {
        coverage: "كل مكان (أقضية + نواحي)",
        size: "طلبات خفيفة",
        cost: "5,000-6,000 د.ع/كارتون",
        payment: "نقدي عند التوصيل",
        speed: "أسرع"
      }
    }
  ];

  const handleContinue = () => {
    if (!selectedType) return;
    
    // Store the selected order type in localStorage or pass it as a parameter
    localStorage.setItem("selectedOrderType", selectedType);
    
    // Navigate to cart with the selected type
    router.push(`/${locale}/cart`);
  };

  const getFeatureIcon = (feature: string) => {
    switch (feature) {
      case "coverage":
        return <MapPin className="h-4 w-4" />;
      case "size":
        return <Package className="h-4 w-4" />;
      case "cost":
        return <DollarSign className="h-4 w-4" />;
      case "payment":
        return <CreditCard className="h-4 w-4" />;
      case "speed":
        return <Clock className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">اختر نوع طلبيتك</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          اختر نوع الطلب المناسب لاحتياجاتك. يمكنك مقارنة المميزات أدناه
        </p>
      </div>

      {/* Order Type Selection */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {orderTypes.map((orderType) => (
          <Card 
            key={orderType.type}
            className={`cursor-pointer transition-all duration-200 ${
              selectedType === orderType.type 
                ? `ring-2 ring-offset-2 ${orderType.borderColor} ${orderType.bgColor}`
                : "hover:shadow-lg"
            }`}
            onClick={() => setSelectedType(orderType.type)}
          >
            <CardHeader className="text-center space-y-4">
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center text-white ${orderType.color}`}>
                {orderType.icon}
              </div>
              <div>
                <CardTitle className="text-xl">{orderType.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {orderType.description}
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Features */}
              <div className="space-y-3">
                {Object.entries(orderType.features).map(([feature, value]) => (
                  <div key={feature} className="flex items-center gap-3 text-sm">
                    <div className={`p-1 rounded ${orderType.bgColor}`}>
                      {getFeatureIcon(feature)}
                    </div>
                    <div className="flex-1">
                      <span className="font-medium">{getFeatureName(feature)}:</span>
                      <span className="text-muted-foreground mr-2">{value}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Selection Indicator */}
              {selectedType === orderType.type && (
                <div className={`flex items-center justify-center gap-2 p-3 rounded-lg ${orderType.bgColor}`}>
                  <CheckCircle className={`h-5 w-5 ${orderType.textColor}`} />
                  <span className={`font-medium ${orderType.textColor}`}>محدد</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison Table - Mobile friendly */}
      <div className="max-w-4xl mx-auto">
        <h3 className="text-xl font-semibold mb-4 text-center">مقارنة سريعة</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-card rounded-lg overflow-hidden shadow-sm">
            <thead>
              <tr className="border-b">
                <th className="text-right p-4 font-medium">&nbsp;</th>
                <th className="text-center p-4 font-medium text-blue-600 bg-blue-50 dark:bg-blue-950/20">
                  طلبية نقليات
                </th>
                <th className="text-center p-4 font-medium text-pink-600 bg-pink-50 dark:bg-pink-950/20">
                  طلبية توصيل
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { key: "التغطية", bulk: "مراكز المدن فقط", delivery: "كل مكان (أقضية + نواحي)" },
                { key: "الحجم", bulk: "كميات كبيرة (جملة)", delivery: "طلبات خفيفة" },
                { key: "الكلفة", bulk: "2,000-3,000 د.ع/كارتون", delivery: "5,000-6,000 د.ع/كارتون" },
                { key: "الدفع", bulk: "آجل (على رصيدك)", delivery: "نقدي عند التوصيل" },
                { key: "السرعة", bulk: "أبطأ", delivery: "أسرع" }
              ].map((row, index) => (
                <tr key={index} className="border-b last:border-b-0">
                  <td className="p-4 font-medium">{row.key}</td>
                  <td className="p-4 text-center text-sm bg-blue-50/50 dark:bg-blue-950/10">{row.bulk}</td>
                  <td className="p-4 text-center text-sm bg-pink-50/50 dark:bg-pink-950/10">{row.delivery}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="flex-1"
        >
          <ArrowLeft className="h-4 w-4 ml-2" />
          رجوع
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!selectedType}
          className="flex-1 min-h-[56px]"
        >
          متابعة إلى السلة
        </Button>
      </div>
    </div>
  );
}

function getFeatureName(feature: string): string {
  switch (feature) {
    case "coverage":
      return "التغطية";
    case "size":
      return "الحجم";
    case "cost":
      return "الكلفة";
    case "payment":
      return "الدفع";
    case "speed":
      return "السرعة";
    default:
      return feature;
  }
}