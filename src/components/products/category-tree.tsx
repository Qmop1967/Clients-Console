"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { TreeNode } from "@/lib/ai/categories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, ZoomIn, ZoomOut, RotateCcw, Loader2 } from "lucide-react";

// Dynamically import react-d3-tree to avoid SSR issues
const Tree = dynamic(
  () => import("react-d3-tree").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[500px] bg-card rounded-xl border">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface CategoryTreeProps {
  treeData: TreeNode;
  onCategorySelect: (categoryId: string, categoryName: string) => void;
  selectedCategory?: string;
  isLoading?: boolean;
}

// Custom node component for the tree
const renderCustomNode = ({
  nodeDatum,
  toggleNode,
  onSelect,
  selectedId,
  isRTL,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodeDatum: any;
  toggleNode: () => void;
  onSelect: (id: string, name: string) => void;
  selectedId?: string;
  isRTL: boolean;
}) => {
  const isSelected = nodeDatum.attributes?.id === selectedId;
  const hasChildren = nodeDatum.children && nodeDatum.children.length > 0;
  const isRoot = nodeDatum.attributes?.id === "root";

  // Larger node dimensions for better readability
  const nodeWidth = 220;
  const nodeHeight = 60;

  return (
    <g>
      {/* Node background */}
      <motion.rect
        x={isRTL ? -nodeWidth + 20 : -20}
        y={-nodeHeight / 2}
        width={nodeWidth}
        height={nodeHeight}
        rx="12"
        className={cn(
          "fill-card stroke-border transition-all duration-200",
          isSelected && "fill-primary/10 stroke-primary stroke-2",
          !isRoot && "cursor-pointer hover:fill-accent/50"
        )}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        onClick={(e) => {
          e.stopPropagation();
          if (!isRoot) {
            onSelect(nodeDatum.attributes?.id, nodeDatum.name);
          }
          if (hasChildren) {
            toggleNode();
          }
        }}
      />

      {/* Icon */}
      {nodeDatum.attributes?.icon && (
        <text
          x={isRTL ? -nodeWidth + 45 : 5}
          y="6"
          textAnchor="middle"
          className="select-none pointer-events-none"
          style={{ fontSize: "22px" }}
        >
          {nodeDatum.attributes.icon}
        </text>
      )}

      {/* Category name */}
      <text
        x={isRTL ? -nodeWidth / 2 + 10 : nodeWidth / 2 - 10}
        y="-4"
        textAnchor="middle"
        className={cn(
          "fill-foreground font-semibold select-none pointer-events-none",
          isSelected && "fill-primary"
        )}
        style={{ fontSize: "14px", direction: isRTL ? "rtl" : "ltr" }}
      >
        {nodeDatum.name.length > 20
          ? nodeDatum.name.substring(0, 18) + "..."
          : nodeDatum.name}
      </text>

      {/* Product count */}
      {nodeDatum.attributes?.count !== undefined && (
        <text
          x={isRTL ? -nodeWidth / 2 + 10 : nodeWidth / 2 - 10}
          y="16"
          textAnchor="middle"
          className="fill-muted-foreground select-none pointer-events-none"
          style={{ fontSize: "12px" }}
        >
          {nodeDatum.attributes.count}{" "}
          {nodeDatum.attributes.count === 1 ? "item" : "items"}
        </text>
      )}

      {/* Expand/collapse indicator */}
      {hasChildren && (
        <motion.circle
          cx={isRTL ? -nodeWidth + 10 : nodeWidth - 10}
          cy="0"
          r="10"
          className="fill-muted stroke-border cursor-pointer hover:fill-primary/20"
          onClick={(e) => {
            e.stopPropagation();
            toggleNode();
          }}
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
        />
      )}
    </g>
  );
};

export function CategoryTree({
  treeData,
  onCategorySelect,
  selectedCategory,
  isLoading = false,
}: CategoryTreeProps) {
  const t = useTranslations("products");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [zoom, setZoom] = useState(0.7);
  // For RTL, start from the right side; for LTR, start from left
  const [translate, setTranslate] = useState({ x: isRTL ? 900 : 150, y: 250 });

  // Reset view handler
  const handleReset = useCallback(() => {
    setZoom(0.7);
    setTranslate({ x: isRTL ? 900 : 150, y: 250 });
  }, [isRTL]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.2, 2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.2, 0.3));
  }, []);

  // Memoized render function
  const renderNode = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rd3tProps: any) =>
      renderCustomNode({
        ...rd3tProps,
        onSelect: onCategorySelect,
        selectedId: selectedCategory,
        isRTL,
      }),
    [onCategorySelect, selectedCategory, isRTL]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[500px] bg-card rounded-xl border">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">{t("loadingCategories")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* AI Badge */}
      <div className="absolute top-4 left-4 rtl:left-auto rtl:right-4 z-10">
        <Badge variant="gold" className="gap-1.5">
          <Sparkles className="h-3 w-3" />
          {t("aiClassified")}
        </Badge>
      </div>

      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4 z-10 flex gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 bg-card/80 backdrop-blur-sm"
          onClick={handleZoomIn}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 bg-card/80 backdrop-blur-sm"
          onClick={handleZoomOut}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 bg-card/80 backdrop-blur-sm"
          onClick={handleReset}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Tree Container */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full h-[500px] bg-gradient-to-br from-card to-card/50 rounded-xl border shadow-lg overflow-hidden"
      >
        <Tree
          data={treeData}
          orientation="horizontal"
          pathFunc="step"
          translate={translate}
          zoom={zoom}
          nodeSize={{ x: 280, y: 120 }}
          separation={{ siblings: 1.2, nonSiblings: 1.8 }}
          renderCustomNodeElement={renderNode}
          pathClassFunc={() =>
            "stroke-border stroke-2 fill-none transition-all duration-300"
          }
          onUpdate={({ zoom: newZoom, translate: newTranslate }) => {
            if (newZoom) setZoom(newZoom);
            if (newTranslate) setTranslate(newTranslate);
          }}
          enableLegacyTransitions
          transitionDuration={300}
        />
      </motion.div>

      {/* Selected Category Info */}
      <AnimatePresence>
        {selectedCategory && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg"
          >
            <p className="text-sm text-muted-foreground">
              {t("selectedCategory")}:{" "}
              <span className="font-semibold text-primary">
                {selectedCategory}
              </span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
