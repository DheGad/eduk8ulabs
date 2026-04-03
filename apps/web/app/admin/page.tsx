import { redirect } from "next/navigation";

/**
 * /admin — redirects straight to the Telemetry Dashboard.
 * Add more admin sub-pages here in future and replace with a nav layout.
 */
export default function AdminPage() {
  redirect("/admin/analytics");
}
