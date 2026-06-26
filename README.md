# Bideros 🏏

[![Live Demo](https://img.shields.io/badge/Live_Demo-bidarena.lovable.app-brightgreen?style=for-the-badge)](https://bideros.vercel.app/)

**The cinematic way to run your cricket auction.**

BidArena is a modern, real-time web application designed to run cricket auctions with the energy and feel of the IPL. It provides a cinematic, stadium-grade experience for admins, team owners, and spectators.

## ✨ Features

- **Race-safe Bidding**: Atomic server-side bids with row locks. No double-clicks, no lost bids.
- **Projector View**: Full-screen cinematic auction display with SOLD stamps and live tickers.
- **Raise-hand Rooms**: Owners tap a giant RAISE HAND button to bid.
- **Realtime Everywhere**: Every bid syncs admin, owners, and spectators in under a second.
- **Tournament Isolation**: Multi-tournament safe. Owners only see their own auction.
- **Built for IPL Energy**: Glassmorphism, neon glow, and animations that make every bid feel huge.

## 🚀 Tech Stack

- **Frontend**: React 19, Vite, TanStack Router/Start
- **Styling**: Tailwind CSS, Radix UI, Framer Motion
- **Backend & Database**: Supabase (PostgreSQL, Realtime, Auth)
- **Deployment**: Cloudflare (via `@cloudflare/vite-plugin`)

## 🛠️ Getting Started

### Prerequisites

- Node.js (v20+ recommended)
- Bun or npm
- Supabase account and project

### Installation

1. Clone the repository
```bash
git clone https://github.com/Khushhalbansal/bidarena.git
cd bidarena
```

2. Install dependencies
```bash
bun install
# or
npm install
```

3. Set up environment variables
Create a `.env` file based on the required Supabase credentials and other configuration needed for the app.

4. Start the development server
```bash
npm run dev
```

## 📜 License & Copyright

This project is built for the love of the game.

Copyright &copy; 2024-2026 Khushhal Bansal. All Rights Reserved.
