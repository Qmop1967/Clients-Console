import { redirect } from "next/navigation";

export default function Home() {
  // Redirect to the public shop page
  redirect("/en/shop");
}
