# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenJustice is a Next.js-based legal case analysis application designed for processing and analyzing legal documents. The project is organized with a clear separation between frontend and potential backend services.

## Tech Stack

- **Framework**: Next.js 15.2.4
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4 with CSS variables
- **UI Components**: shadcn/ui components (New York style)
- **Package Manager**: pnpm (with bun.lock also present)
- **Font**: Geist Sans/Mono
- **Analytics**: Vercel Analytics

## Development Commands

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint
```

## Project Structure

```
/frontend               # All frontend code
  /app                  # Next.js App Router directory
    layout.tsx         # Root layout with Geist fonts and Analytics
    page.tsx           # Main legal case analysis UI (client-side)
    globals.css        # Global styles and Tailwind imports
  
  /components
    /ui                # shadcn/ui components library
    theme-provider.tsx # Theme context provider
  
  /lib                 # Utility functions and helpers
  /hooks               # Custom React hooks
  /public              # Static assets
  /styles              # Additional style files
  
  # Frontend config files
  package.json         # Frontend dependencies and scripts
  tsconfig.json        # TypeScript configuration
  next.config.mjs      # Next.js configuration
  postcss.config.mjs   # PostCSS configuration
  components.json      # shadcn/ui configuration
  tailwind.config.js   # Tailwind CSS configuration

/backend                # Flask backend API
  app.py               # Main Flask application
  /services            # Business logic services
    file_handler.py    # File upload and management
    document_processor.py # PDF text extraction
    query_engine.py    # LLM integration for queries
  /uploads             # Uploaded files storage (gitignored)
  requirements.txt     # Python dependencies
  .env.example        # Environment variables template
```

## Key Application Features

The main application (`frontend/app/page.tsx`) is a legal document analysis interface with:
- File upload system supporting PDFs, audio, video, and images
- Query interface for asking questions about uploaded documents
- Sidebar with chat history and case management
- Multi-query support with Shift+Enter for new queries
- Real-time processing status indicators
- User profile dropdown menu

## Component Architecture

- Uses shadcn/ui component system with New York styling variant
- Components are client-side rendered (`"use client"`)
- Heavy use of Radix UI primitives for accessible components
- Lucide React for iconography
- Custom UI components in `/frontend/components/ui/`

## Path Aliases

- `@/*`: Maps to frontend root directory
- `@/components`: Component directory
- `@/lib`: Library/utility directory
- `@/hooks`: Custom hooks directory

## Important Notes

- All frontend code is contained within the `/frontend` directory
- The application is primarily client-side rendered
- Uses CSS variables for theming (configured in Tailwind)
- Component imports use the `@/` alias pattern
- The main page component manages complex state for file uploads, queries, and chat history
- Sidebar navigation includes collapsible states and user profile management