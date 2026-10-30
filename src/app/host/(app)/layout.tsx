import { redirect } from "next/navigation";
import { getHostSession } from "@/lib/auth/session";
import { ArenaBackground } from "@/components/arena/background";
import { HostNav } from "@/components/host/host-nav";

/** Guards every admin screen. The projector route guards itself separately. */
export default async function HostAppLayout({ children }: { children: React.ReactNode }) {
  const session = await getHostSession();
  if (!session) redirect("/host/login");

  return (
    <div className="relative min-h-dvh">
      <ArenaBackground />
      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 py-6 sm:px-8">
        <HostNav email={session.email} />
        <main className="mt-8">{children}</main>
      </div>
    </div>
  );
}
