import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../contexts/AuthContext";
import { RecaptchaProvider } from "../components/auth/RecaptchaProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "InvoNest - AI-Powered Invoicing & Compliance Platform",
  description: "Secure, AI-powered invoicing and compliance platform for Indian MSMEs, freelancers, and gig workers. GST-compliant invoice generation with blockchain integrity.",
  keywords: ["invoicing", "GST", "compliance", "AI", "MSME", "India", "tax", "blockchain"],
  authors: [{ name: "InvoNest Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-gray-50`}>
        <RecaptchaProvider>
          <AuthProvider>
            <div className="min-h-screen">
              {children}
            </div>
          </AuthProvider>
        </RecaptchaProvider>
      </body>
    </html>
  );
}
