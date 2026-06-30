"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import ThemeToggle from "./ThemeToggle";
import { useProfile } from "@/context/ProfileContext";
import ProfileModal from "@/components/profile/ProfileModal";

const dropdowns = [
  {
    label: "League History",
    links: [
      { href: "/standings", label: "Standings" },
      { href: "/trade-tracker", label: "Trade Tracker" },
    ],
  },
  {
    label: "Tools",
    links: [
      { href: "/idp-checker", label: "Waiver Check" },
      { href: "/roster-management", label: "Roster Management" },
      { href: "/taxi-filler", label: "Taxi Filler" },
    ],
  },
];

const NavBar = () => {
  const pathname = usePathname();
  const [openState, setOpenState] = useState({ index: null, path: null });
  const [profileDropdownState, setProfileDropdownState] = useState({ open: false, path: null });
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const profileDropdownOpen = profileDropdownState.open && profileDropdownState.path === pathname;
  const closeProfileDropdown = () => setProfileDropdownState({ open: false, path: null });
  const toggleProfileDropdown = () =>
    setProfileDropdownState(profileDropdownOpen
      ? { open: false, path: null }
      : { open: true, path: pathname });
  const navRef = useRef(null);

  const { profile, activeLeagueId, setActiveLeagueId, clearProfile } =
    useProfile();

  const isOpen = (i) =>
    openState.index === i && openState.path === pathname;
  const toggle = (i) =>
    setOpenState(
      isOpen(i)
        ? { index: null, path: null }
        : { index: i, path: pathname }
    );

  const isActive = (href) => pathname.startsWith(href);
  const groupIsActive = (links) => links.some(({ href }) => isActive(href));

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenState({ index: null, path: null });
        closeProfileDropdown();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <nav
        ref={navRef}
        className="border-b border-gray-200 bg-white/90 backdrop-blur-sm dark:border-pitch-700 dark:bg-pitch-900/80"
      >
        <div className="mx-auto flex max-w-[120rem] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🏈</span>
            <span className="text-lg font-black tracking-tighter text-gray-900 dark:text-slate-100">
              IDP Dynasty HQ
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-1">
            {dropdowns.map(({ label, links }, i) => {
              const active = groupIsActive(links);
              const open = isOpen(i);
              return (
                <div key={label} className="relative">
                  <button
                    onClick={() => toggle(i)}
                    className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      active
                        ? "bg-amber-400 text-gray-900"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-pitch-800 dark:hover:text-white"
                    }`}
                  >
                    {label}
                    <svg
                      className={`h-3.5 w-3.5 transition-transform ${
                        open ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  {open && (
                    <div className="absolute right-0 top-full z-50 mt-1 min-w-[11rem] rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-pitch-700 dark:bg-pitch-800">
                      {links.map(({ href, label: linkLabel }) => (
                        <Link
                          key={href}
                          href={href}
                          className={`block px-4 py-2 text-sm font-medium transition ${
                            isActive(href)
                              ? "bg-amber-400 text-gray-900"
                              : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-200 dark:hover:bg-pitch-700 dark:hover:text-white"
                          }`}
                        >
                          {linkLabel}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Profile area */}
            {!profile ? (
              <button
                onClick={() => setProfileModalOpen(true)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-pitch-800 dark:hover:text-white"
              >
                Set up profile
              </button>
            ) : (
              <div className="relative">
                <button
                  onClick={toggleProfileDropdown}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-pitch-800 dark:hover:text-white"
                >
                  @{profile.sleeperUsername}
                  <svg
                    className={`h-3.5 w-3.5 transition-transform ${
                      profileDropdownOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {profileDropdownOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1 min-w-[13rem] rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-pitch-700 dark:bg-pitch-800">
                    {profile.leagues.map((league) => {
                      const isPrimary =
                        league.leagueId === profile.primaryLeagueId;
                      const isActiveLg = league.leagueId === activeLeagueId;
                      return (
                        <button
                          key={league.leagueId}
                          onClick={() => {
                            setActiveLeagueId(league.leagueId);
                            closeProfileDropdown();
                          }}
                          className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium transition ${
                            isActiveLg
                              ? "bg-green-700 text-white"
                              : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-200 dark:hover:bg-pitch-700 dark:hover:text-white"
                          }`}
                        >
                          {isPrimary && (
                            <span className="text-amber-400">★</span>
                          )}
                          <span className="flex-1 truncate">{league.name}</span>
                        </button>
                      );
                    })}
                    <hr className="my-1 border-gray-100 dark:border-pitch-700" />
                    <button
                      onClick={() => {
                        closeProfileDropdown();
                        setProfileModalOpen(true);
                      }}
                      className="block w-full px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-200 dark:hover:bg-pitch-700 dark:hover:text-white"
                    >
                      Edit profile
                    </button>
                    <button
                      onClick={() => {
                        clearProfile();
                        closeProfileDropdown();
                      }}
                      className="block w-full px-4 py-2 text-left text-sm font-medium text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      Clear profile
                    </button>
                  </div>
                )}
              </div>
            )}

            <ThemeToggle />
          </div>
        </div>
      </nav>
      {profileModalOpen && (
        <ProfileModal onClose={() => setProfileModalOpen(false)} />
      )}
    </>
  );
};

export default NavBar;
