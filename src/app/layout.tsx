import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/lib/auth-context";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BG-Health v2",
  description: "BG-Health v2 - PT. BAGONG DEKAKA MAKMUR",
};

/* Production-only devtools deterrent script */
const devtoolsScript = `
(function(){
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') return;
  var threshold = 160;
  var check = function(){
    var widthDiff = window.outerWidth - window.innerWidth;
    var heightDiff = window.outerHeight - window.innerHeight;
    if (widthDiff > threshold || heightDiff > threshold) {
      console.warn('%c⚠ Security Warning: Developer tools detected. Unauthorized debugging is prohibited.', 'color: #ff4d00; font-size: 14px; font-weight: bold;');
    }
  };
  setInterval(check, 3000);
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
        <Script id="devtools-deterrent" strategy="afterInteractive">
          {devtoolsScript}
        </Script>
      </body>
    </html>
  );
}
