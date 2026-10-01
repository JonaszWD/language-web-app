import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";

export default async function RootPage() {
  const user = await getMe();
  redirect(user ? "/home" : "/login");
}
