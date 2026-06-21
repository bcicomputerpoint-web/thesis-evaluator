import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Onusandhan — PhD Thesis Evaluator",
  description:
    "AI-powered thesis evaluation against UGC Regulations 2022, Shodhganga/INFLIBNET standards, and university DRC/RAC requirements. 9 groups, 52 criteria.",
  keywords: "PhD thesis evaluation, UGC 2022, Shodhganga, INFLIBNET, DRC, RAC, India, Onusandhan",
  openGraph: {
    title: "Onusandhan — PhD Thesis Evaluator",
    description: "AI-powered compliance checker for Indian PhD scholars",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
