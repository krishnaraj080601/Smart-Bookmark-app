export const metadata = {
  title: "Smart Bookmark",
  description: "Realtime Bookmark Manager",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

