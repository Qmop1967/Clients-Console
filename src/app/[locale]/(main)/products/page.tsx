import { redirect } from "next/navigation";

// Redirect /products to /shop for backward compatibility
// The /shop page handles both authenticated and public users
export default function ProductsRedirect() {
  redirect("/shop");
}
