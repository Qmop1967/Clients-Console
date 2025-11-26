import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";

export async function generateMetadata() {
  const t = await getTranslations("accountStatement");
  return {
    title: t("title"),
  };
}

// Mock transactions
const mockTransactions = [
  {
    transaction_id: "1",
    transaction_type: "invoice",
    transaction_number: "INV-2024-0045",
    date: "2024-01-15",
    debit: 450000,
    credit: 0,
    balance: 2700000,
    description: "Sales Invoice",
  },
  {
    transaction_id: "2",
    transaction_type: "payment",
    transaction_number: "PMT-2024-0023",
    date: "2024-01-14",
    debit: 0,
    credit: 200000,
    balance: 2250000,
    description: "Bank Transfer Payment",
  },
  {
    transaction_id: "3",
    transaction_type: "invoice",
    transaction_number: "INV-2024-0044",
    date: "2024-01-10",
    debit: 320000,
    credit: 0,
    balance: 2450000,
    description: "Sales Invoice",
  },
  {
    transaction_id: "4",
    transaction_type: "payment",
    transaction_number: "PMT-2024-0022",
    date: "2024-01-10",
    debit: 0,
    credit: 450000,
    balance: 2130000,
    description: "Cash Payment",
  },
  {
    transaction_id: "5",
    transaction_type: "credit_note",
    transaction_number: "CN-2024-0008",
    date: "2024-01-12",
    debit: 0,
    credit: 45000,
    balance: 2580000,
    description: "Credit Note - Return",
  },
];

export default async function AccountStatementPage() {
  const session = await auth();
  const t = await getTranslations("accountStatement");

  if (!session?.user) {
    redirect("/login");
  }

  const currencyCode = session.user.currencyCode || "IQD";

  const formatCurrency = (amount: number) => {
    if (amount === 0) return "-";
    return (
      new Intl.NumberFormat("en-IQ", {
        style: "decimal",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount) + ` ${currencyCode}`
    );
  };

  const openingBalance = 2500000;
  const closingBalance =
    mockTransactions[mockTransactions.length - 1]?.balance || openingBalance;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <Button variant="outline" size="sm">
            <Download className="mr-1 h-4 w-4" />
            {t("download")}
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("openingBalance")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatCurrency(openingBalance)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("closingBalance")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">
                {formatCurrency(closingBalance)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        {mockTransactions.length === 0 ? (
          <div className="py-12 text-center">
            <FileSpreadsheet className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t("noTransactions")}</p>
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">
                        {t("date")}
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        {t("transaction")}
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        {t("debit")}
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        {t("credit")}
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        {t("balance")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockTransactions.map((tx) => (
                      <tr key={tx.transaction_id} className="border-b">
                        <td className="px-4 py-3 text-muted-foreground">
                          {tx.date}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">
                              {tx.transaction_number}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {tx.description}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-destructive">
                          {formatCurrency(tx.debit)}
                        </td>
                        <td className="px-4 py-3 text-right text-green-600">
                          {formatCurrency(tx.credit)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatCurrency(tx.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
