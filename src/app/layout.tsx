import './globals.css';

// Root layout：实际 <html>/<body> 在 [locale]/layout.tsx（next-intl 推荐结构）
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
