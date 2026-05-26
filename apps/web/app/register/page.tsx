import { redirect } from "next/navigation";

// /register → /onboard (the real enterprise trial onboarding flow)
// This preserves all incoming links from emails, marketing, nav CTAs.
export default function RegisterPage() {
  redirect("/onboard");
}
