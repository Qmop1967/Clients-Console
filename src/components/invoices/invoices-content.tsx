"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import {
  FileText,
  ChevronRight,
  ChevronLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Calendar,
  TrendingUp,
  Eye,
  ArrowUpRight,
  Search,
  Download,
  Filter,
  Receipt,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import type { ZohoInvoice } from "@/types";
import type { InvoiceSummaryStats } from "@/lib/zoho/invoices";
import { cn } from "@/lib/utils/cn";

interface PageContext {
  page: number;
  per_page: number;
  has_more_page: boolean;
  total: number;
  total_pages: number;
}

interface InvoicesContentProps {
  invoices: ZohoInvoice[];
  pageContext: PageContext;
  currentPage: number;
  currencyCode: string;
  summaryStats: InvoiceSummaryStats | null;
}

type FilterStatus = "all" | "overdue" | "pending" | "paid";

export function InvoicesContent({
  invoices,
  pageContext,
  currentPage,
  currencyCode,
  summaryStats,
}: InvoicesContentProps) {
  const t = useTranslations("invoices");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");

  const formatCurrency = (amount: number, currency?: string) => {
    const curr = currency || currencyCode;
    const decimals = curr === "IQD" ? 0 : 2;
    return (
      new Intl.NumberFormat("en-US", {
        style: "decimal",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount) + ` ${curr}`
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  // Check if invoice is overdue
  const isInvoiceOverdue = (invoice: ZohoInvoice) => {
    const dueDate = new Date(invoice.due_date);
    return invoice.balance > 0 && dueDate < new Date();
  };

  // Check if invoice is pending (has balance but not overdue)
  const isInvoicePending = (invoice: ZohoInvoice) => {
    const dueDate = new Date(invoice.due_date);
    return invoice.balance > 0 && dueDate >= new Date();
  };

  // Check if invoice is paid
  const isInvoicePaid = (invoice: ZohoInvoice) => {
    return invoice.balance === 0;
  };

  // Filter invoices based on search and status filter
  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      // Search filter
      const matchesSearch = searchQuery === "" ||
        invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      let matchesStatus = true;
      switch (activeFilter) {
        case "overdue":
          matchesStatus = isInvoiceOverdue(invoice);
          break;
        case "pending":
          matchesStatus = isInvoicePending(invoice);
          break;
        case "paid":
          matchesStatus = isInvoicePaid(invoice);
          break;
      }

      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchQuery, activeFilter]);

  // Use server-provided summary stats for accurate totals across ALL invoices
  // Fall back to page-based calculation if stats not available
  const totalAmount = summaryStats?.totalAmount ?? invoices.reduce((sum, inv) => sum + inv.total, 0);
  const paidAmount = summaryStats?.paidAmount ?? invoices.reduce((sum, inv) => sum + (inv.total - inv.balance), 0);
  const overdueAmount = summaryStats?.overdueAmount ?? invoices.filter(isInvoiceOverdue).reduce((sum, inv) => sum + inv.balance, 0);
  const pendingAmount = summaryStats?.pendingAmount ?? invoices.filter(isInvoicePending).reduce((sum, inv) => sum + inv.balance, 0);

  // Counts for the current page (used for local filtering)
  const pageOverdueInvoices = invoices.filter(isInvoiceOverdue);
  const pagePendingInvoices = invoices.filter(isInvoicePending);
  const pagePaidInvoicesCount = invoices.filter(isInvoicePaid).length;

  // Filter counts - use overall stats for the tab badges
  const filterCounts = {
    all: summaryStats?.totalCount ?? pageContext.total,
    overdue: summaryStats?.overdueCount ?? pageOverdueInvoices.length,
    pending: summaryStats?.pendingCount ?? pagePendingInvoices.length,
    paid: summaryStats?.paidCount ?? pagePaidInvoicesCount,
  };

  const getStatusConfig = (status: string, dueDate: string, balance: number) => {
    const statusLower = status?.toLowerCase() || "draft";
    const dueDateObj = new Date(dueDate);
    const today = new Date();
    const isOverdue = balance > 0 && dueDateObj < today;
    const isDueSoon = balance > 0 && dueDateObj > today &&
      (dueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) <= 7;

    if (isOverdue || statusLower === "overdue") {
      return {
        label: t("invoiceStatus.overdue"),
        variant: "destructive" as const,
        icon: AlertCircle,
        className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
        iconColor: "text-red-500",
        bgColor: "bg-red-500",
      };
    }

    switch (statusLower) {
      case "paid":
        return {
          label: t("invoiceStatus.paid"),
          variant: "default" as const,
          icon: CheckCircle2,
          className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
          iconColor: "text-green-500",
          bgColor: "bg-green-500",
        };
      case "partially_paid":
        return {
          label: t("invoiceStatus.partially_paid"),
          variant: "secondary" as const,
          icon: TrendingUp,
          className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
          iconColor: "text-blue-500",
          bgColor: "bg-blue-500",
        };
      case "sent":
        return {
          label: t("invoiceStatus.sent"),
          variant: "outline" as const,
          icon: isDueSoon ? Clock : FileText,
          className: isDueSoon
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
            : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
          iconColor: isDueSoon ? "text-amber-500" : "text-slate-500",
          bgColor: isDueSoon ? "bg-amber-500" : "bg-slate-400",
        };
      case "viewed":
        return {
          label: t("invoiceStatus.viewed"),
          variant: "outline" as const,
          icon: Eye,
          className: isDueSoon
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
            : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
          iconColor: isDueSoon ? "text-amber-500" : "text-purple-500",
          bgColor: isDueSoon ? "bg-amber-500" : "bg-purple-500",
        };
      case "void":
        return {
          label: t("invoiceStatus.void"),
          variant: "secondary" as const,
          icon: XCircle,
          className: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
          iconColor: "text-gray-500",
          bgColor: "bg-gray-400",
        };
      default: // draft
        return {
          label: t("invoiceStatus.draft"),
          variant: "secondary" as const,
          icon: FileText,
          className: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
          iconColor: "text-slate-500",
          bgColor: "bg-slate-400",
        };
    }
  };

  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDueDateLabel = (dueDate: string, balance: number) => {
    if (balance === 0) return null;
    const days = getDaysUntilDue(dueDate);
    if (days < 0) {
      return { text: t("daysOverdue", { count: Math.abs(days) }), className: "text-red-500" };
    } else if (days === 0) {
      return { text: t("dueToday"), className: "text-amber-500" };
    } else if (days === 1) {
      return { text: t("dueTomorrow"), className: "text-amber-500" };
    } else if (days <= 7) {
      return { text: t("dueInDays", { count: days }), className: "text-amber-500" };
    }
    return null;
  };

  // Calculate showing range
  const startItem = (currentPage - 1) * pageContext.per_page + 1;
  const endItem = Math.min(currentPage * pageContext.per_page, pageContext.total);

  return (
    <div className="space-y-6">
      {/* Header - Luxury styling */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <Receipt className="h-5 w-5 text-amber-600 dark:text-amber-500" strokeWidth={1.5} />
            </div>
            {t("title")}
          </h1>
          {pageContext.total > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              {t("showing", { from: startItem, to: endItem, total: pageContext.total })}
            </p>
          )}
        </div>
      </div>

      {/* Summary Cards - Premium elevated styling */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card variant="elevated" className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 border-slate-200/50 dark:border-slate-700/50 hover:shadow-lg transition-all duration-300 cursor-pointer hover:-translate-y-0.5"
                onClick={() => setActiveFilter("all")}>
            <div className="absolute end-0 top-0 h-20 w-20 translate-x-6 -translate-y-6 rounded-full bg-slate-500/10" />
            <CardContent className="p-4 relative">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-slate-500/10 p-3">
                  <FileText className="h-6 w-6 text-slate-600 dark:text-slate-400" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{t("total")}</p>
                  <p className="stat-currency text-2xl truncate">{formatCurrency(totalAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" className={cn(
            "relative overflow-hidden bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border-green-200/50 dark:border-green-700/50 hover:shadow-lg transition-all duration-300 cursor-pointer hover:-translate-y-0.5",
            activeFilter === "paid" && "ring-2 ring-green-500"
          )} onClick={() => setActiveFilter(activeFilter === "paid" ? "all" : "paid")}>
            <div className="absolute end-0 top-0 h-20 w-20 translate-x-6 -translate-y-6 rounded-full bg-green-500/10" />
            <CardContent className="p-4 relative">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-green-500/10 p-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{t("invoiceStatus.paid")}</p>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                      {filterCounts.paid}
                    </Badge>
                  </div>
                  <p className="stat-currency text-2xl text-green-600 dark:text-green-400 truncate">{formatCurrency(paidAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" className={cn(
            "relative overflow-hidden bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 border-amber-200/50 dark:border-amber-700/50 hover:shadow-lg transition-all duration-300 cursor-pointer hover:-translate-y-0.5",
            activeFilter === "pending" && "ring-2 ring-amber-500"
          )} onClick={() => setActiveFilter(activeFilter === "pending" ? "all" : "pending")}>
            <div className="absolute end-0 top-0 h-20 w-20 translate-x-6 -translate-y-6 rounded-full bg-amber-500/10" />
            <CardContent className="p-4 relative">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-500/10 p-3">
                  <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{t("pending")}</p>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                      {filterCounts.pending}
                    </Badge>
                  </div>
                  <p className="stat-currency text-2xl text-amber-600 dark:text-amber-400 truncate">{formatCurrency(pendingAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" className={cn(
            "relative overflow-hidden bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10 border-red-200/50 dark:border-red-700/50 hover:shadow-lg transition-all duration-300 cursor-pointer hover:-translate-y-0.5",
            activeFilter === "overdue" && "ring-2 ring-red-500"
          )} onClick={() => setActiveFilter(activeFilter === "overdue" ? "all" : "overdue")}>
            <div className="absolute end-0 top-0 h-20 w-20 translate-x-6 -translate-y-6 rounded-full bg-red-500/10" />
            <CardContent className="p-4 relative">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-red-500/10 p-3">
                  <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{t("invoiceStatus.overdue")}</p>
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      {filterCounts.overdue}
                    </Badge>
                  </div>
                  <p className="stat-currency text-2xl text-red-600 dark:text-red-400 truncate">{formatCurrency(overdueAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filter Bar */}
      {invoices.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search - Premium styling */}
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              variant="premium"
              className="ps-9 h-10"
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
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 min-w-[1.25rem]">
                {filterCounts.all}
              </Badge>
            </Button>
            <Button
              variant={activeFilter === "overdue" ? "destructive" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter("overdue")}
              className="h-8 px-3 text-xs"
            >
              {t("invoiceStatus.overdue")}
              {filterCounts.overdue > 0 && (
                <Badge variant={activeFilter === "overdue" ? "secondary" : "destructive"} className="ml-1.5 text-[10px] px-1.5 py-0 min-w-[1.25rem]">
                  {filterCounts.overdue}
                </Badge>
              )}
            </Button>
            <Button
              variant={activeFilter === "pending" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter("pending")}
              className={cn("h-8 px-3 text-xs", activeFilter === "pending" && "bg-amber-500 hover:bg-amber-600")}
            >
              {t("pending")}
              {filterCounts.pending > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 min-w-[1.25rem]">
                  {filterCounts.pending}
                </Badge>
              )}
            </Button>
            <Button
              variant={activeFilter === "paid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter("paid")}
              className={cn("h-8 px-3 text-xs", activeFilter === "paid" && "bg-green-500 hover:bg-green-600")}
            >
              {t("invoiceStatus.paid")}
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 min-w-[1.25rem]">
                {filterCounts.paid}
              </Badge>
            </Button>
          </div>
        </div>
      )}

      {/* Active Filter Indicator */}
      {(activeFilter !== "all" || searchQuery) && (
        <div className="flex items-center gap-2 text-sm">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">{t("filterActive")}:</span>
          {activeFilter !== "all" && (
            <Badge variant="outline" className="gap-1">
              {activeFilter === "overdue" && t("invoiceStatus.overdue")}
              {activeFilter === "pending" && t("pending")}
              {activeFilter === "paid" && t("invoiceStatus.paid")}
              <button
                onClick={() => setActiveFilter("all")}
                className="ml-1 hover:text-destructive"
              >
                ×
              </button>
            </Badge>
          )}
          {searchQuery && (
            <Badge variant="outline" className="gap-1">
              &quot;{searchQuery}&quot;
              <button
                onClick={() => setSearchQuery("")}
                className="ml-1 hover:text-destructive"
              >
                ×
              </button>
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => {
              setActiveFilter("all");
              setSearchQuery("");
            }}
          >
            {t("clearFilters")}
          </Button>
        </div>
      )}

      {/* Invoices List */}
      {invoices.length === 0 ? (
        <Card variant="elevated" className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="rounded-full bg-muted w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="font-display text-lg font-semibold mb-2">{t("noInvoices")}</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              {t("noInvoicesDescription")}
            </p>
          </CardContent>
        </Card>
      ) : filteredInvoices.length === 0 ? (
        <Card variant="elevated" className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="rounded-full bg-muted w-14 h-14 flex items-center justify-center mx-auto mb-4">
              <Search className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="font-display text-base font-semibold mb-1">{t("noFilterResults")}</h3>
            <p className="text-muted-foreground text-sm">
              {t("noFilterResultsDescription")}
            </p>
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
        <div className="space-y-3">
          {filteredInvoices.map((invoice) => {
            const statusConfig = getStatusConfig(invoice.status, invoice.due_date, invoice.balance);
            const StatusIcon = statusConfig.icon;
            const dueDateLabel = getDueDateLabel(invoice.due_date, invoice.balance);

            return (
              <Card
                key={invoice.invoice_id}
                variant="interactive"
                className={cn(
                  "overflow-hidden transition-all duration-300 group",
                  "hover:shadow-lg hover:shadow-amber-500/5",
                  "hover:border-amber-500/30",
                )}
              >
                <CardContent className="p-0">
                  <div className="flex items-stretch">
                    {/* Status Indicator Bar */}
                    <div className={cn("w-1.5 shrink-0", statusConfig.bgColor)} />

                    {/* Main Content */}
                    <Link
                      href={`/invoices/${invoice.invoice_id}`}
                      className="flex-1 p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Left Section */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={cn(
                              "rounded-full p-2 shrink-0 transition-transform group-hover:scale-110",
                              statusConfig.className.replace("border-", "")
                            )}>
                              <StatusIcon className={cn("h-4 w-4", statusConfig.iconColor)} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-display font-semibold text-base">
                                  {invoice.invoice_number}
                                </span>
                                <Badge className={cn("text-xs border", statusConfig.className)}>
                                  {statusConfig.label}
                                </Badge>
                              </div>
                              {dueDateLabel && (
                                <p className={cn("text-xs font-medium mt-0.5", dueDateLabel.className)}>
                                  {dueDateLabel.text}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Invoice Details */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-3">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>{formatDate(invoice.date)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{t("dueDate")}: {formatDate(invoice.due_date)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Right Section - Amounts */}
                        <div className="text-right shrink-0">
                          <p className="price-display text-lg">
                            {formatCurrency(invoice.total, invoice.currency_code)}
                          </p>
                          {invoice.balance > 0 && invoice.balance !== invoice.total && (
                            <p className="text-sm text-muted-foreground">
                              {t("invoiceStatus.paid")}: {formatCurrency(invoice.total - invoice.balance, invoice.currency_code)}
                            </p>
                          )}
                          {invoice.balance > 0 && (
                            <p className="text-sm font-medium text-destructive">
                              {t("balance")}: {formatCurrency(invoice.balance, invoice.currency_code)}
                            </p>
                          )}
                          {invoice.balance === 0 && (
                            <p className="text-sm font-medium text-green-600 dark:text-green-400">
                              {t("fullyPaid")}
                            </p>
                          )}
                        </div>

                        {/* Arrow Icon */}
                        <div className="flex items-center self-center">
                          <ArrowUpRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>

                      {/* Payment Progress Bar for partially paid invoices */}
                      {invoice.balance > 0 && invoice.balance < invoice.total && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                            <span>{t("paymentProgress")}</span>
                            <span>{Math.round((1 - invoice.balance / invoice.total) * 100)}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all duration-500"
                              style={{ width: `${(1 - invoice.balance / invoice.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </Link>

                    {/* Quick Actions */}
                    {invoice.invoice_url && (
                      <div className="flex items-center px-2 border-l border-border/50">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-muted-foreground hover:text-primary"
                          onClick={(e) => {
                            e.preventDefault();
                            window.open(invoice.invoice_url, '_blank');
                          }}
                          title={t("downloadPdf")}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Enhanced Pagination */}
      {pageContext.total_pages > 1 && (
        <Card className="mt-6">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Page Info */}
              <p className="text-sm text-muted-foreground order-2 sm:order-1">
                {t("showing", { from: startItem, to: endItem, total: pageContext.total })}
              </p>

              {/* Pagination Controls */}
              <div className="flex items-center gap-1 order-1 sm:order-2">
                {/* First Page */}
                <Link
                  href={currentPage > 1 ? `/invoices?page=1` : "#"}
                  className={currentPage <= 1 ? "pointer-events-none" : ""}
                >
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage <= 1}
                    className="h-9 w-9"
                    title={t("firstPage")}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                </Link>

                {/* Previous */}
                <Link
                  href={currentPage > 1 ? `/invoices?page=${currentPage - 1}` : "#"}
                  className={currentPage <= 1 ? "pointer-events-none" : ""}
                >
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage <= 1}
                    className="h-9 w-9"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </Link>

                {/* Page Numbers */}
                <div className="flex items-center gap-1 px-2">
                  {Array.from({ length: Math.min(5, pageContext.total_pages) }, (_, i) => {
                    let pageNum: number;
                    if (pageContext.total_pages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= pageContext.total_pages - 2) {
                      pageNum = pageContext.total_pages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <Link key={pageNum} href={`/invoices?page=${pageNum}`}>
                        <Button
                          variant={currentPage === pageNum ? "default" : "ghost"}
                          size="icon"
                          className={cn(
                            "h-9 w-9",
                            currentPage === pageNum && "pointer-events-none"
                          )}
                        >
                          {pageNum}
                        </Button>
                      </Link>
                    );
                  })}
                </div>

                {/* Next */}
                <Link
                  href={pageContext.has_more_page ? `/invoices?page=${currentPage + 1}` : "#"}
                  className={!pageContext.has_more_page ? "pointer-events-none" : ""}
                >
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={!pageContext.has_more_page}
                    className="h-9 w-9"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>

                {/* Last Page */}
                <Link
                  href={currentPage < pageContext.total_pages ? `/invoices?page=${pageContext.total_pages}` : "#"}
                  className={currentPage >= pageContext.total_pages ? "pointer-events-none" : ""}
                >
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage >= pageContext.total_pages}
                    className="h-9 w-9"
                    title={t("lastPage")}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              {/* Page Selector */}
              <div className="hidden sm:flex items-center gap-2 order-3 text-sm text-muted-foreground">
                <span>{t("page")}</span>
                <span className="font-medium text-foreground">{currentPage}</span>
                <span>{t("of")}</span>
                <span className="font-medium text-foreground">{pageContext.total_pages}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
