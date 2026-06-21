import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import NavBar from "./(components)/NavBar";
import Footer from "./(components)/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IDP Dynasty HQ",
  description:
    "A suite of fantasy football tools for Sleeper IDP dynasty leagues — standings, trade tracking, IDP availability, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen`}>
        <NavBar />
        <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
