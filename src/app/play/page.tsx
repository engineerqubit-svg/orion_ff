import { redirect } from "next/navigation";

/** `/play` has nothing to show on its own — the PIN entry lives on the landing page. */
export default function PlayIndexPage() {
  redirect("/");
}
