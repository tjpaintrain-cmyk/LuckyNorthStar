export const metadata = { title: 'LuckyNorthStar', description: 'Sweepstakes casino skeleton' };

export default function RootLayout({ children }:{ children: React.ReactNode }){
  return (
    <html lang="en">
      <body className="bg-black text-white">{children}</body>
    </html>
  );
}
