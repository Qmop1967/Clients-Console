"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  hasMorePage: boolean;
  baseHref: string;
  className?: string;
}

/**
 * Reusable Pagination Component
 * Used across Orders, Invoices, Payments, Credit Notes pages
 */
export function Pagination({
  currentPage,
  totalPages,
  hasMorePage,
  baseHref,
  className,
}: PaginationProps) {
  const t = useTranslations("common");

  if (totalPages <= 1) return null;

  // Generate page numbers to display
  const getPageNumbers = (): (number | "...")[] => {
    const pages: (number | "...")[] = [];
    const showPages = 5; // Number of page buttons to show

    if (totalPages <= showPages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push("...");
      }

      // Pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push("...");
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className={cn("flex items-center justify-center gap-2 pt-4", className)}>
      {/* Previous Button */}
      <Link
        href={currentPage > 1 ? `${baseHref}?page=${currentPage - 1}` : "#"}
        className={cn(currentPage <= 1 && "pointer-events-none")}
      >
        <Button variant="outline" size="sm" disabled={currentPage <= 1}>
          <ChevronLeft className="h-4 w-4 me-1 rtl:rotate-180" />
          {t("previous")}
        </Button>
      </Link>

      {/* Page Numbers */}
      <div className="hidden sm:flex items-center gap-1">
        {pageNumbers.map((page, index) =>
          page === "..." ? (
            <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
              ...
            </span>
          ) : (
            <Link key={page} href={`${baseHref}?page=${page}`}>
              <Button
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                className="w-10"
              >
                {page}
              </Button>
            </Link>
          )
        )}
      </div>

      {/* Page indicator for mobile */}
      <span className="sm:hidden text-sm text-muted-foreground px-4">
        {t("page")} {currentPage} / {totalPages}
      </span>

      {/* Next Button */}
      <Link
        href={hasMorePage ? `${baseHref}?page=${currentPage + 1}` : "#"}
        className={cn(!hasMorePage && "pointer-events-none")}
      >
        <Button variant="outline" size="sm" disabled={!hasMorePage}>
          {t("next")}
          <ChevronRight className="h-4 w-4 ms-1 rtl:rotate-180" />
        </Button>
      </Link>
    </div>
  );
}

/**
 * Simple pagination for client-side state management
 */
interface SimplePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function SimplePagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: SimplePaginationProps) {
  const t = useTranslations("common");

  if (totalPages <= 1) return null;

  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <div className={cn("flex items-center justify-center gap-2 pt-4", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!hasPrevious}
      >
        <ChevronLeft className="h-4 w-4 me-1 rtl:rotate-180" />
        {t("previous")}
      </Button>

      <span className="text-sm text-muted-foreground px-4">
        {t("page")} {currentPage} / {totalPages}
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!hasNext}
      >
        {t("next")}
        <ChevronRight className="h-4 w-4 ms-1 rtl:rotate-180" />
      </Button>
    </div>
  );
}

/**
 * Enhanced Numbered Pagination Component
 * Features: Numbered buttons, prev/next arrows, "Go to page" input
 * Used on shop page above and below products
 */
interface NumberedPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function NumberedPagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: NumberedPaginationProps) {
  const t = useTranslations("common");
  const [goToPage, setGoToPage] = useState("");

  const handleGoToPage = useCallback(() => {
    const pageNum = parseInt(goToPage, 10);
    if (pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setGoToPage("");
    }
  }, [goToPage, totalPages, onPageChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleGoToPage();
      }
    },
    [handleGoToPage]
  );

  if (totalPages <= 1) return null;

  // Generate page numbers with ellipsis
  const getPageNumbers = (): (number | "...")[] => {
    const pages: (number | "...")[] = [];
    const maxVisible = 7; // Max page buttons to show

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 4) {
        pages.push("...");
      }

      // Pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (i > 1 && i < totalPages) {
          pages.push(i);
        }
      }

      if (currentPage < totalPages - 3) {
        pages.push("...");
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 w-full", className)}>
      {/* Main pagination row - centered, force LTR for consistent arrow direction */}
      <div className="flex items-center justify-center gap-2" dir="ltr">
        {/* Previous Arrow - Always on LEFT */}
        <button
          onClick={() => hasPrevious && onPageChange(currentPage - 1)}
          disabled={!hasPrevious}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full transition-all border",
            hasPrevious
              ? "border-border bg-background hover:bg-muted cursor-pointer text-foreground"
              : "border-transparent bg-muted/50 text-muted-foreground/40 cursor-not-allowed"
          )}
          aria-label={t("previous")}
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1} />
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1.5">
          {pageNumbers.map((page, index) =>
            page === "..." ? (
              <span
                key={`ellipsis-${index}`}
                className="flex h-10 w-10 items-center justify-center text-muted-foreground"
              >
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                aria-label={`${t("page")} ${page}`}
                aria-current={currentPage === page ? "page" : undefined}
                className={cn(
                  "flex h-10 min-w-10 px-3 items-center justify-center rounded-full font-medium transition-all border",
                  currentPage === page
                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                    : "border-border bg-background hover:bg-muted text-foreground"
                )}
              >
                {page}
              </button>
            )
          )}
        </div>

        {/* Next Arrow - Always on RIGHT */}
        <button
          onClick={() => hasNext && onPageChange(currentPage + 1)}
          disabled={!hasNext}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full transition-all border",
            hasNext
              ? "border-border bg-background hover:bg-muted cursor-pointer text-foreground"
              : "border-transparent bg-muted/50 text-muted-foreground/40 cursor-not-allowed"
          )}
          aria-label={t("next")}
        >
          <ChevronRight className="h-5 w-5" strokeWidth={1} />
        </button>
      </div>

      {/* Go to Page Input - separate row for cleaner look */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {t("goToPage")}
        </span>
        <Input
          type="number"
          min={1}
          max={totalPages}
          value={goToPage}
          onChange={(e) => setGoToPage(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-16 h-9 text-center rounded-lg border-border"
          placeholder="..."
          aria-label={t("goToPage")}
        />
        <span className="text-sm text-muted-foreground">/ {totalPages}</span>
      </div>
    </div>
  );
}
