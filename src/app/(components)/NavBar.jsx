"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const links = [
  { href: "/", label: "Home" },
  { href: "/standings", label: "Standings" },
  { href: "/trade-tracker", label: "Trade Tracker" },
  { href: "/idp-checker", label: "Waiver Check" },
  { href: "/injury-tracker", label: "Injury Tracker" },
];

const NavBar = () => {
  const pathname = usePathname();

  const isActive = (href) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="border-b border-gray-200 bg-white/90 backdrop-blur-sm dark:border-pitch-700 dark:bg-pitch-900/80">
      <div className="mx-auto flex max-w-[120rem] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🏈</span>
          <span className="text-lg font-black tracking-tighter text-gray-900 dark:text-slate-100">
            IDP Dynasty HQ
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive(href)
                  ? "bg-amber-400 text-gray-900"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-pitch-800 dark:hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
