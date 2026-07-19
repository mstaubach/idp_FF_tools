import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AccountPanel from "@/components/auth/AccountPanel";

export const metadata: Metadata = {
  title: "Account — IDP Dynasty HQ",
};

// Session-dependent; never prerender.
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-black tracking-tight text-gray-900 dark:text-slate-100">
        Your account
      </h1>
      <AccountPanel
        email={session.user.email ?? ""}
        displayName={session.user.name ?? null}
        plan={session.user.plan}
      />
    </div>
  );
}
