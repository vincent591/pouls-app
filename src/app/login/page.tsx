import { redirect } from "next/navigation";
import { getSession, defaultSpaceFor } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import LoginCard from "@/components/LoginCard";

const ROLE_LABEL = {
  employee: "Employé·e",
  manager: "Manager · Équipe Produit",
  admin: "RH · Admin",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { from?: string };
}) {
  const session = await getSession();
  if (session?.user.role) redirect(`/${defaultSpaceFor(session.user.role)}`);

  const azureConfigured = !!process.env.AZURE_AD_CLIENT_ID;
  const googleConfigured = !!process.env.GOOGLE_CLIENT_ID;
  const demoEnabled = process.env.ENABLE_DEMO_LOGIN === "true";

  const demoAccounts = demoEnabled
    ? (
        await prisma.user.findMany({
          where: { demoPasswordHash: { not: null } },
          select: { email: true, name: true, role: true },
          orderBy: { createdAt: "asc" },
        })
      ).map((u) => ({ email: u.email, name: u.name, roleLabel: ROLE_LABEL[u.role] }))
    : [];

  return (
    <div className="flex justify-center pt-6">
      <LoginCard
        azureConfigured={azureConfigured}
        googleConfigured={googleConfigured}
        demoAccounts={demoAccounts}
        callbackUrl={searchParams.from ?? "/"}
      />
    </div>
  );
}
