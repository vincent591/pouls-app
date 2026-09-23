import MagicLinkVerifier from "@/components/MagicLinkVerifier";

export default function VerifyPage({
  searchParams,
}: {
  searchParams: { email?: string; token?: string };
}) {
  return (
    <div className="flex justify-center pt-6">
      <MagicLinkVerifier email={searchParams.email ?? null} token={searchParams.token ?? null} />
    </div>
  );
}
