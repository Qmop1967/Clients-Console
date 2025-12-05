import { redirect } from "next/navigation";

// Redirect /products to /shop for backward compatibility
// This page is outside the (main) protected route group
// so it redirects without requiring authentication
export default function ProductsRedirect() {
  redirect("/shop");
}
