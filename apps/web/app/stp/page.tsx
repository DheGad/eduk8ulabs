import { redirect } from "next/navigation";

// /stp → redirects to the STP whitepaper section on the main page or holds until dedicated page is built
export default function STPPage() {
  redirect("/#why-it-matters");
}
