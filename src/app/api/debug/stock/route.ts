// Debug endpoint to check Zoho stock data
import { NextResponse } from "next/server";
import { zohoFetch } from "@/lib/zoho/client";

const WHOLESALE_WAREHOUSE_NAME = "WholeSale WareHouse (Warehouse)";
const WHOLESALE_WAREHOUSE_ID = "2646610000000077024"; // From Zoho

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("item_id");
  const search = searchParams.get("search");
  const testWarehouse = searchParams.get("test_warehouse");

  try {
    // Test warehouse filtering
    if (testWarehouse) {
      // Test: Fetch with warehouse_id filter
      const dataWithWarehouse = await zohoFetch<{ items: Record<string, unknown>[] }>("/items", {
        api: "inventory",
        params: {
          search_text: "UPS DC DATCO",
          per_page: 5,
          warehouse_id: WHOLESALE_WAREHOUSE_ID,
        },
      });

      // Compare: Fetch without warehouse_id filter
      const dataWithoutWarehouse = await zohoFetch<{ items: Record<string, unknown>[] }>("/items", {
        api: "inventory",
        params: {
          search_text: "UPS DC DATCO",
          per_page: 5,
        },
      });

      return NextResponse.json({
        warehouse_id_used: WHOLESALE_WAREHOUSE_ID,
        with_warehouse_filter: dataWithWarehouse.items.map((item) => ({
          item_id: item.item_id,
          name: item.name,
          available_stock: item.available_stock,
          stock_on_hand: item.stock_on_hand,
          actual_available_for_sale_stock: item.actual_available_for_sale_stock,
        })),
        without_warehouse_filter: dataWithoutWarehouse.items.map((item) => ({
          item_id: item.item_id,
          name: item.name,
          available_stock: item.available_stock,
          stock_on_hand: item.stock_on_hand,
          actual_available_for_sale_stock: item.actual_available_for_sale_stock,
        })),
      });
    }

    // Search for item by name
    if (search) {
      const searchData = await zohoFetch<{ items: Record<string, unknown>[] }>("/items", {
        api: "inventory",
        params: {
          search_text: search,
          per_page: 10,
        },
      });

      return NextResponse.json({
        search_query: search,
        results: searchData.items.map((item) => ({
          item_id: item.item_id,
          name: item.name,
          stock_on_hand: item.stock_on_hand,
          available_stock: item.available_stock,
          actual_available_stock: item.actual_available_stock,
        })),
      });
    }

    // If item_id provided, fetch single item with full warehouse data
    if (itemId) {
      const data = await zohoFetch<{ item: Record<string, unknown> }>(`/items/${itemId}`, {
        api: "inventory",
      });

      const item = data.item;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const warehouses = (item.warehouses as any[]) || [];
      const wholesaleWarehouse = warehouses.find(
        (w) => w.warehouse_name === WHOLESALE_WAREHOUSE_NAME
      );

      // Return all item fields for debugging
      return NextResponse.json({
        item_id: item.item_id,
        name: item.name,
        // Show ALL fields from Zoho response
        raw_item: item,
        warehouses_count: warehouses.length,
        wholesale_warehouse: wholesaleWarehouse || null,
      });
    }

    // If no item_id, fetch first 5 items from list to compare
    const listData = await zohoFetch<{ items: Record<string, unknown>[] }>("/items", {
      api: "inventory",
      params: {
        page: 1,
        per_page: 5,
        filter_by: "Status.Active",
      },
    });

    return NextResponse.json({
      message: "List endpoint check - warehouses data may be missing",
      items: listData.items.map((item) => ({
        item_id: item.item_id,
        name: item.name,
        stock_on_hand: item.stock_on_hand,
        available_stock: item.available_stock,
        has_warehouses: !!(item.warehouses && (item.warehouses as unknown[]).length > 0),
        warehouses_count: (item.warehouses as unknown[] | undefined)?.length || 0,
      })),
      note: "Pass ?item_id=XXX to get full warehouse breakdown for a specific item",
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
