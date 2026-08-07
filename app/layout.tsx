import type { Metadata } from "next";
import { Assistant, Cormorant } from "next/font/google";
import "./globals.css";

const assistant = Assistant({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: true,
  variable: "--font-assistant",
});

const cormorant = Cormorant({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  preload: true,
  variable: "--font-cormorant",
});

export const metadata: Metadata = {
  title: "Tending the Healer | Threshold Therapy & Consulting",
  description:
    "A restorative retreat for healthcare professionals on October 10, 2026, at the House of Welcome Longhouse in Olympia, Washington.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${assistant.variable} ${cormorant.variable}`}>
      <body>{children}</body>
    </html>
  );
}
