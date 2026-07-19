import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign in — IDP Dynasty HQ",
};

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-black tracking-tight text-gray-900 dark:text-slate-100">
        Sign in
      </h1>
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-pitch-700 dark:bg-pitch-900">
        {/* Suspense: LoginForm reads ?callbackUrl via useSearchParams */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
