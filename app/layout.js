import './globals.css';

export const metadata = {
  title: 'Smart Bookmark',
  description: 'Manage bookmarks efficiently',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
