export const metadata = {
  title: "WhiteFinance API",
  description: "WhiteFinance backend API and blockchain reader",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
