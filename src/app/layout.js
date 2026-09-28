import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// PWA യ്ക്കും ആപ്പിനുമുള്ള Metadata 📝
export const metadata = {
  title: "സുൻദൂഖുൽ മുവാസാത്ത്",
  description: "Financial Management App",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sundooq",
  },
};

// Theme Color സജ്ജീകരിക്കുന്നത് 🎨
export const viewport = {
  themeColor: "#059669",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="ml"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50">{children}</body>
    </html>
  );
}