import type { Metadata } from "next";
import SignupForm from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Create account — IDP Dynasty HQ",
};

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-black tracking-tight text-gray-900 dark:text-slate-100">
        Create account
      </h1>
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-pitch-700 dark:bg-pitch-900">
        <SignupForm />
      </div>
    </div>
  );
}
