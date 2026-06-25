"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/standings", label: "Standings" },
  { href: "/trade-tracker", label: "Trade Tracker" },
  { href: "/idp-checker", label: "IDP Checker" },
  { href: "/injury-tracker", label: "Injury Tracker" },
];

const NavBar = () => {
  const pathname = usePathname();

  const isActive = (href) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="border-b border-pitch-700 bg-pitch-900/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[120rem] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🏈</span>
          <span className="text-lg font-extrabold tracking-tight">
            IDP Dynasty HQ
          </span>
        </Link>
        <div className="flex flex-wrap gap-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive(href)
                  ? "bg-emerald-600 text-white"
                  : "text-slate-300 hover:bg-pitch-800 hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
