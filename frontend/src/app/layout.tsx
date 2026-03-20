import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Header, Footer } from "@/components/Layout";
import { TermsGuard } from "@/components/TermsGuard";

export const metadata: Metadata = {
  title: "Jubilee Lending | Interest-Free Loans on Base",
  description:
    "Deposit BTC collateral, borrow jUSDi interest-free. Powered by yield, secured by Chainlink oracles.",
  openGraph: {
    title: "Jubilee Lending | Interest-Free Loans on Base",
    description: "Deposit BTC, borrow jUSDi at 0% interest. Your collateral yield pays off your debt.",
    siteName: "Jubilee Lending",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <TermsGuard>
            <div
              style={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Header />
              <main
                style={{
                  flex: 1,
                  padding: "2rem",
                  maxWidth: "1100px",
                  margin: "0 auto",
                  width: "100%",
                }}
              >
                <div className="page-enter">{children}</div>
              </main>
              <Footer />
            </div>
          </TermsGuard>
        </Providers>
      </body>
    </html>
  );
}
