# Budget Tracker

A personal expense and budget tracker with Supabase backend, hosted on GitHub Pages.

## Project structure

```
budget-tracker/
├── index.html          ← HTML structure only, no inline JS or CSS
├── css/
│   └── style.css       ← All styling and CSS variables
├── js/
│   ├── supabase.js     ← Supabase API calls (sbGet, sbInsert, sbDelete, sbUpsert)
│   ├── state.js        ← Shared state, constants, and helper functions
│   ├── home.js         ← Dashboard, category cards, weekly bar chart
│   ├── transactions.js ← Add/delete transactions, expense modal
│   ├── budgets.js      ← Budget settings, save budgets
│   ├── categories.js   ← Add/delete custom categories
│   ├── import.js       ← Westpac PDF parsing and bulk import review
│   └── app.js          ← Page navigation, data loading, init
└── README.md
```

## Features
- Weekly and monthly budget tracking
- Daily spending bar chart with week navigation
- Custom categories (emoji + colour)
- Add expenses manually
- Import Westpac PDF bank statements via AI parsing
- All data stored in Supabase PostgreSQL

## Tech stack
- **Frontend:** Vanilla HTML/CSS/JS — no framework
- **Backend:** Supabase (PostgreSQL + REST API)
- **PDF parsing:** PDF.js
- **AI extraction:** Claude API (claude-sonnet-4-20250514)
- **Hosting:** GitHub Pages

## Development workflow
1. Clone this repo in VS Code
2. Make changes to any file
3. Go to Source Control (Ctrl+Shift+G)
4. Type a commit message → Commit & Push
5. GitHub Pages redeploys automatically in ~60 seconds

## Supabase tables
- `categories` — custom expense categories
- `transactions` — individual expenses
- `budgets` — weekly/monthly limits per category
