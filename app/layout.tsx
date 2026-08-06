import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tending the Healer | Threshold Therapy & Consulting",
  description:
    "A restorative retreat for healthcare professionals on October 10, 2026, at the House of Welcome Longhouse in Olympia, Washington.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
