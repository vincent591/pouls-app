import { redirect } from "next/navigation";
import { getSession, defaultSpaceFor } from "@/lib/access";

export default async function Home() {
  const session = await getSession();
  if (!session || !session.user.role) redirect("/login");
  redirect(`/${defaultSpaceFor(session.user.role)}`);
}
