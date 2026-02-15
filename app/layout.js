import './globals.css';
import { Toaster } from 'react-hot-toast';  // ← ADD THIS LINE

export const metadata = {
  title: 'Smart Bookmark',
  description: 'Manage bookmarks efficiently',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="top-center" />  {/* ← ADD THIS LINE */}
      </body>
    </html>
  );
}