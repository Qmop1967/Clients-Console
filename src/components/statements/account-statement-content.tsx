"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  CreditCard,
  FileCheck,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Banknote,
  ScrollText,
} from "lucide-react";
import type { AccountStatementData, StatementTransaction } from "@/lib/zoho/statements";
import { cn } from "@/lib/utils/cn";

interface AccountStatementContentProps {
  statement: AccountStatementData;
  currencyCode: string;
}

type FilterType = "all" | "invoice" | "payment" | "credit_note";

export function AccountStatementContent({
  statement,
  currencyCode,
}: AccountStatementContentProps) {
  const t = useTranslations("accountStatement");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const currency = statement.currency_code || currencyCode;

  const formatCurrency = (amount: number, showSign = false) => {
    if (amount === 0) return "-";
    const decimals = currency === "IQD" ? 0 : 2;
    const formatted = new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Math.abs(amount));

    if (showSign && amount !== 0) {
      return `${amount > 0 ? '+' : '-'}${formatted} ${currency}`;
    }
    return `${formatted} ${currency}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date);
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return statement.transactions.filter((tx) => {
      const matchesSearch =
        searchQuery === "" ||
        tx.transaction_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFilter =
        activeFilter === "all" || tx.transaction_type === activeFilter;

      return matchesSearch && matchesFilter;
    });
  }, [statement.transactions, searchQuery, activeFilter]);

  // Calculate filter counts
  const filterCounts = useMemo(() => ({
    all: statement.transactions.length,
    invoice: statement.transactions.filter((t) => t.transaction_type === "invoice").length,
    payment: statement.transactions.filter((t) => t.transaction_type === "payment").length,
    credit_note: statement.transactions.filter((t) => t.transaction_type === "credit_note").length,
  }), [statement.transactions]);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "invoice":
        return FileText;
      case "payment":
        return CreditCard;
      case "credit_note":
        return FileCheck;
      default:
        return Receipt;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "invoice":
        return {
          bg: "bg-red-500/10",
          text: "text-red-600 dark:text-red-400",
          badge: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
          bar: "bg-red-500",
        };
      case "payment":
        return {
          bg: "bg-green-500/10",
          text: "text-green-600 dark:text-green-400",
          badge: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
          bar: "bg-green-500",
        };
      case "credit_note":
        return {
          bg: "bg-blue-500/10",
          text: "text-blue-600 dark:text-blue-400",
          badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
          bar: "bg-blue-500",
        };
      default:
        return {
          bg: "bg-slate-500/10",
          text: "text-slate-600 dark:text-slate-400",
          badge: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
          bar: "bg-slate-500",
        };
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ScrollText className="h-7 w-7 text-primary" />
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDate(statement.from_date)} - {formatDate(statement.to_date)}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          {t("download")}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Debits (Invoices) */}
        <Card className="bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10 border-red-200/50 dark:border-red-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-500/10 p-2.5">
                <TrendingUp className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t("totalDebit")}</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400 truncate">
                  {formatCurrency(statement.total_debits)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Credits (Payments + Credit Notes) */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border-green-200/50 dark:border-green-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-500/10 p-2.5">
                <TrendingDown className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t("totalCredit")}</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400 truncate">
                  {formatCurrency(statement.total_credits)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Opening Balance */}
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 border-slate-200/50 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-slate-500/10 p-2.5">
                <Wallet className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t("openingBalance")}</p>
                <p className="text-xl font-bold truncate">
                  {formatCurrency(statement.opening_balance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Closing Balance */}
        <Card className={cn(
          "bg-gradient-to-br border",
          statement.closing_balance > 0
            ? "from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 border-amber-200/50 dark:border-amber-700/50"
            : "from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border-green-200/50 dark:border-green-700/50"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "rounded-full p-2.5",
                statement.closing_balance > 0 ? "bg-amber-500/10" : "bg-green-500/10"
              )}>
                <Banknote className={cn(
                  "h-5 w-5",
                  statement.closing_balance > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-green-600 dark:text-green-400"
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t("closingBalance")}</p>
                <p className={cn(
                  "text-xl font-bold truncate",
                  statement.closing_balance > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-green-600 dark:text-green-400"
                )}>
                  {formatCurrency(statement.closing_balance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      {statement.transactions.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
            <Button
              variant={activeFilter === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter("all")}
              className="h-8 px-3 text-xs"
            >
              {t("filterAll")}
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                {filterCounts.all}
              </Badge>
            </Button>
            <Button
              variant={activeFilter === "invoice" ? "destructive" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter("invoice")}
              className="h-8 px-3 text-xs"
            >
              {t("invoices")}
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                {filterCounts.invoice}
              </Badge>
            </Button>
            <Button
              variant={activeFilter === "payment" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter("payment")}
              className={cn("h-8 px-3 text-xs", activeFilter === "payment" && "bg-green-500 hover:bg-green-600")}
            >
              {t("payments")}
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                {filterCounts.payment}
              </Badge>
            </Button>
            <Button
              variant={activeFilter === "credit_note" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter("credit_note")}
              className={cn("h-8 px-3 text-xs", activeFilter === "credit_note" && "bg-blue-500 hover:bg-blue-600")}
            >
              {t("credits")}
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                {filterCounts.credit_note}
              </Badge>
            </Button>
          </div>
        </div>
      )}

      {/* Transactions List */}
      {statement.transactions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="rounded-full bg-muted w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <ScrollText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{t("noTransactions")}</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              {t("noTransactionsDescription")}
            </p>
          </CardContent>
        </Card>
      ) : filteredTransactions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="rounded-full bg-muted w-14 h-14 flex items-center justify-center mx-auto mb-4">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-1">{t("noFilterResults")}</h3>
            <p className="text-muted-foreground text-sm">{t("noFilterResultsDescription")}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setActiveFilter("all");
                setSearchQuery("");
              }}
            >
              {t("clearFilters")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-muted/50 border-b text-sm font-medium text-muted-foreground">
              <div className="col-span-2">{t("date")}</div>
              <div className="col-span-4">{t("transaction")}</div>
              <div className="col-span-2 text-right">{t("debit")}</div>
              <div className="col-span-2 text-right">{t("credit")}</div>
              <div className="col-span-2 text-right">{t("balance")}</div>
            </div>

            {/* Transaction Rows */}
            <div className="divide-y divide-border">
              {filteredTransactions.map((tx, index) => {
                const Icon = getTransactionIcon(tx.transaction_type);
                const colors = getTransactionColor(tx.transaction_type);
                const isExpanded = expandedRows.has(tx.transaction_id);

                return (
                  <div
                    key={tx.transaction_id}
                    className={cn(
                      "group transition-colors",
                      "hover:bg-muted/30"
                    )}
                  >
                    {/* Desktop View */}
                    <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-4 items-center">
                      {/* Date */}
                      <div className="col-span-2 flex items-center gap-2">
                        <div className="text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 inline mr-1" />
                          {formatDate(tx.date)}
                        </div>
                      </div>

                      {/* Transaction */}
                      <div className="col-span-4 flex items-center gap-3">
                        <div className={cn("rounded-full p-2", colors.bg)}>
                          <Icon className={cn("h-4 w-4", colors.text)} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate">{tx.transaction_number}</span>
                            <Badge className={cn("text-[10px] border shrink-0", colors.badge)}>
                              {tx.transaction_type === "invoice" && t("invoice")}
                              {tx.transaction_type === "payment" && t("payment")}
                              {tx.transaction_type === "credit_note" && t("creditNote")}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{tx.description}</p>
                        </div>
                      </div>

                      {/* Debit */}
                      <div className="col-span-2 text-right">
                        {tx.debit > 0 ? (
                          <span className="font-medium text-red-600 dark:text-red-400">
                            {formatCurrency(tx.debit)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>

                      {/* Credit */}
                      <div className="col-span-2 text-right">
                        {tx.credit > 0 ? (
                          <span className="font-medium text-green-600 dark:text-green-400">
                            {formatCurrency(tx.credit)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>

                      {/* Balance */}
                      <div className="col-span-2 text-right">
                        <span className="font-bold">{formatCurrency(tx.balance)}</span>
                      </div>
                    </div>

                    {/* Mobile View */}
                    <div
                      className="md:hidden p-4 cursor-pointer"
                      onClick={() => toggleRow(tx.transaction_id)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Status Bar */}
                        <div className={cn("w-1 h-full min-h-[4rem] rounded-full", colors.bar)} />

                        {/* Icon */}
                        <div className={cn("rounded-full p-2 shrink-0", colors.bg)}>
                          <Icon className={cn("h-4 w-4", colors.text)} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-semibold truncate">{tx.transaction_number}</span>
                              <Badge className={cn("text-[10px] border shrink-0", colors.badge)}>
                                {tx.transaction_type === "invoice" && t("invoice")}
                                {tx.transaction_type === "payment" && t("payment")}
                                {tx.transaction_type === "credit_note" && t("creditNote")}
                              </Badge>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>

                          <p className="text-xs text-muted-foreground mt-0.5">{tx.description}</p>

                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground">
                              {formatDateShort(tx.date)}
                            </span>
                            <div className="flex items-center gap-3">
                              {tx.debit > 0 && (
                                <span className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                                  <ArrowUpRight className="h-3 w-3" />
                                  {formatCurrency(tx.debit)}
                                </span>
                              )}
                              {tx.credit > 0 && (
                                <span className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                                  <ArrowDownLeft className="h-3 w-3" />
                                  {formatCurrency(tx.credit)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{t("balance")}:</span>
                                <span className="font-bold">{formatCurrency(tx.balance)}</span>
                              </div>
                              {tx.due_date && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">{t("dueDate")}:</span>
                                  <span>{formatDate(tx.due_date)}</span>
                                </div>
                              )}
                              {tx.reference_number && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">{t("reference")}:</span>
                                  <span>{tx.reference_number}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary Footer */}
            <div className="bg-muted/30 border-t px-4 py-4">
              <div className="hidden md:grid grid-cols-12 gap-4 items-center font-semibold">
                <div className="col-span-6 text-right">{t("totals")}:</div>
                <div className="col-span-2 text-right text-red-600 dark:text-red-400">
                  {formatCurrency(statement.total_debits)}
                </div>
                <div className="col-span-2 text-right text-green-600 dark:text-green-400">
                  {formatCurrency(statement.total_credits)}
                </div>
                <div className="col-span-2 text-right">
                  {formatCurrency(statement.closing_balance)}
                </div>
              </div>

              {/* Mobile Summary */}
              <div className="md:hidden space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("totalDebit")}:</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    {formatCurrency(statement.total_debits)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("totalCredit")}:</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {formatCurrency(statement.total_credits)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground font-medium">{t("closingBalance")}:</span>
                  <span className="font-bold text-lg">{formatCurrency(statement.closing_balance)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Count Info */}
      {filteredTransactions.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          {t("showing")} {filteredTransactions.length} {t("of")} {statement.transactions.length} {t("transactions")}
        </p>
      )}
    </div>
  );
}
