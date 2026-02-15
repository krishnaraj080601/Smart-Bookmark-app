# 📌 Smart Bookmark – Full Stack Bookmark Manager

Smart Bookmark is a modern full-stack web application built with Next.js and Supabase that allows users to securely save, manage, and search bookmarks with real-time updates and automatic metadata extraction.

---

# 🏗 Project Architecture Overview

The application follows a full-stack architecture using:

- **Frontend:** Next.js (App Router)
- **Backend:** Next.js API Routes
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Google OAuth
- **Realtime Engine:** Supabase Realtime (Postgres Changes)
- **Metadata Parsing:** Cheerio (Server-side HTML parsing)

The project is structured to separate:

- UI Layer
- Business Logic
- API Layer
- Database Layer

---

# 📂 Project Structure

smart-bookmark/
│
├── app/
│ ├── page.js → Main dashboard (bookmarks UI)
│ ├── login/page.js → Google login page
│ └── api/
│ ├── metadata/route.js → Metadata extraction API
│ └── search/route.js → Web search API
│
├── lib/
│ └── supabase.js → Supabase client configuration
│
├── public/ → Static assets
│
├── README.md
├── .env.local
└── package.json

---

# 🔐 Authentication Flow (How It Works)

1. User clicks **Continue with Google**
2. Supabase handles OAuth flow
3. After authentication, user is redirected to dashboard
4. Supabase session is stored client-side
5. Protected route checks for authenticated user
6. If no user → redirect to `/login`

Row Level Security (RLS) ensures:


So users can only access their own bookmarks.

---

# 🗄 Database Design

Table: `bookmarks`

| Column      | Type      | Description |
|------------|----------|------------|
| id         | uuid     | Primary key |
| title      | text     | Bookmark title |
| url        | text     | Website URL |
| user_id    | uuid     | Linked to authenticated user |
| created_at | timestamp| Auto-generated |

Security:
- RLS Enabled
- Policy ensures user-level isolation

---

# ⚡ Real-Time Sync

The app subscribes to:


2. Server:
   - Validates URL
   - Fetches HTML
   - Parses Open Graph & Twitter meta tags
   - Extracts:
     - Title
     - Description
     - Favicon
   - Returns structured JSON

Why server-side?
- Avoid CORS issues
- Hide scraping logic
- Add timeout protection (5s)

---

# 🌐 Web Search Feature

The app integrates with:

DuckDuckGo Instant Answer API

Flow:
1. User searches query
2. API fetches results
3. Results displayed
4. User can directly add result as bookmark

---

# 🔍 Search Optimization

Client-side search uses:

- 300ms debounce hook
- Prevents unnecessary re-renders
- Improves UX performance

---

# 📄 Pagination

- Page size: 6 bookmarks
- "Load More" button
- Prevents rendering large datasets at once

---

# 🌙 Dark Mode

- Local state-based toggle
- Dynamic Tailwind styling
- Fully responsive UI

---

# 🛠 Tech Stack

Frontend:
- Next.js (App Router)
- React
- Tailwind CSS
- Framer Motion
- React Hot Toast

Backend:
- Next.js API Routes
- Cheerio (HTML parsing)

Database:
- Supabase PostgreSQL
- Supabase Auth
- Supabase Realtime

---

# ⚙️ Environment Variables

Create `.env.local`:

NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key

---

# ▶️ Run Locally

npm install
npm run dev


Runs on:


http://localhost:3000

---

# 🚀 Deployment

Deployed using Vercel.

Steps:
1. Push to GitHub
2. Import into Vercel
3. Add environment variables
4. Deploy

---

# 🔮 Future Improvements

- Server-side pagination
- Redis caching for metadata
- Bookmark tags & categories
- Drag-and-drop sorting
- PWA support
- Preview image support

---

# 👨‍💻 Author

Krishna Raj


