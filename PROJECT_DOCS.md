# STEPAN Price List Converter - Project Documentation

## Project Overview
This is a web-based utility designed to facilitate supplier data management. It features two primary modules:
1. **Price List Converter**: Standardizes Excel/CSV price lists with automated SKU/Alias generation.
2. **Inventory Tracker**: Real-time monitoring of availability in Google Sheets with Telegram notifications.

## Technical Stack
- **Framework**: React 19 (Vite + TypeScript)
- **Styling**: Vanilla CSS (Modern aesthetic with glassmorphism)
- **Infrastructure**: Vercel (Cloud Hosting + Serverless Functions + Cron Jobs)
- **Database**:
  - **Supabase (PostgreSQL)**: Primary cloud database for inventory tracking, snapshots, and global settings.
  - **IndexedDB**: Local browser storage for the Price List Converter (sessions & history).
- **Libraries**:
  - `xlsx`: For parsing and exporting Excel files
  - `papaparse`: For CSV parsing
  - `lucide-react`: For iconography
  - `translate`: For RU <-> UA machine translation
  - `@supabase/supabase-js`: Client for cloud database interaction

## Core Features & Logic

### 1. SKU (Articul) & Alias Generation
Defined in `src/utils/generators.ts`.
- **SKU Cleaning**: Removes common product words and formats names into hyphens.
- **Alias**: Transliterates Cyrillic to Latin and creates SEO-friendly slugs.
- **Translation**: High-quality machine translation (RU $\leftrightarrow$ UA) using the `translate` library (Google Translate engine). 
  - **Caching**: Includes an in-memory `translationCache` to minimize API calls for repetitive words.
  - **Async Execution**: Functions are asynchronous to ensure non-blocking UI during batch processing.
- **Default Marketing Notes**: Every row is automatically populated with standardized HTML notes (yellow highlight) in `Примітки(RU)` and `Примітки(UA)` regarding wholesale prices and payment methods.
- **Auto-populating States**: "Состояние товара" is set to "Новое" and "Отображать" to "1" by default for all rows.

### 2. Manual Data Editing
Interactive editing directly in the results table:
- **Inline Editing**: Single-click any cell in the results table to modify its value. Hovering over a cell shows an edit icon and highlight for clarity.
- **Category Selection**: The "Category" column (10th column) uses a specialized dropdown menu with values from a centralized registry (`src/constants/categories.ts`).
- **Bulk Updates**: Pencil icon in the column header allows applying a single value (or choosing from a dropdown if it's the category column) to an entire column.

### 3. Image Search & Assignment
- **Google Search**: One-click lookup for product images based on the name.
- **Direct Link Preview**: Users can paste an image URL, preview it, and approve.
- **Automated Naming**: Approved photos are assigned the name `{SKU}.jpg` and saved in the "Photo" column (index 17).

### 4. Session Persistence & History
- **Auto-save**: All edits are automatically saved to the browser's IndexedDB. Refreshing the page doesn't lose data.
- **History Modal**: Access previous versions of your price lists. You can restore a past session or delete old ones to save space.
- **Mapping Cache**: The system remembers your start row and column mapping for each file.

### 6. Inventory Tracking & Notifications
Defined in `src/components/InventoryTracker.tsx`, `src/utils/inventoryStorage.ts`.
- **Supabase Backend**: All tracker configurations and snapshots are stored in the cloud, enabling cross-device synchronization.
- **Google Sheets Monitoring**: Track changes in specific columns (Product Name and Availability) of public Google Sheets.
- **Change Detection**: Compares current data with the previous snapshot stored in Supabase to identify items that became available (🟢), unavailable (🔴), or changed state (🟡).
- **Telegram Notifications**: Automated alerts sent via Telegram bot whenever changes are detected.
- **Cloud Autopilot (Vercel Cron)**: 
  - **Automated Scheduler**: A serverless function (`api/check-inventory.ts`) runs every day at **09:00 (Kyiv time)** independently of the browser.
  - **Manual Trigger**: Users can still trigger checks manually from the web UI.
- **Visual Diffing**: Interactive preview of detected changes before and after the update.

## User Interface Flow
The application uses a tab-based navigation to switch between the two main modules.

### Module A: Price List Converter
#### Step 1: Upload & Configuration
- Upload a local file (XLSX/CSV) or import from public Google Sheets.
- Set **Start Row**: Specify where actual data begins (e.g., Row 24 if the file has headers/info at the top).
- **Manual Mapping**: Use dropdowns to tell the system which columns represent Name, Price, or Brand.

#### Step 2: Review (Raw & Processed)
- **Raw Integrity Check**: View the source file's original structure.
- **REFERENCE EXAMPLE**: A target template that stays perfectly aligned vertically with your processed data for easy comparison.
- **YOUR PROCESSED DATA**: View the results in the target 43-column format. 
  - **Sticky Name Column**: The "Product Name (RU)" column stays fixed on the left during horizontal scrolling.
  - **Synced Scrolling**: The Reference and Processed tables scroll together horizontally to maintain perfect alignment.
  - Perform manual edits or image searches here.

#### Step 3: Export
- Download the final result as a `.xlsx` file formatted specifically for target marketplace imports.

### Module B: Inventory Tracker
- **Add Tracker**: Configure Google Sheet URL, specify columns (e.g., Name in 'B', Availability in 'G'), and set start row.
- **Global Settings**: Configure Telegram Bot Token and Chat ID for notifications.
- **Monitoring**: Perform manual checks or rely on the automated schedule (09:00/16:00 Kyiv).
- **History**: View past snapshots and change history for each tracked document.

## Serverless & API
- `api/check-inventory.ts`: Core logic for the cloud autopilot (Vercel serverless function).
- `vercel.json`: Configuration for Vercel Cron Jobs and routing.

## Key Files
- `src/main.tsx`: App Shell with navigation and routing.
- `src/App.tsx`: Converter module UI and state coordination.
- `src/components/InventoryTracker.tsx`: Monitoring module UI and manual/local scheduler coordination.
- `src/lib/supabaseClient.ts`: Supabase client initialization.
- `src/utils/inventoryStorage.ts`: Supabase-based storage logic for trackers, snapshots, and settings.
- `src/utils/mapper.ts`: Asynchronous logic for populating the 44-column target schema.
- `src/utils/generators.ts`: SKU/Alias generation and Cached Translation API wrapper.
- `src/constants/categories.ts`: Central registry for product categories.
- `src/utils/storage.ts`: IndexedDB persistence layer for the Converter module.

## Environment Variables
Required for deployment and local development (see `.env`):
- `VITE_SUPABASE_URL`: Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Supabase anon (public) key.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role secret (Required on Vercel for Cron Job bypass and write access).

## Troubleshooting
- **Black Screen / Red Error**: Usually caused by malformed files with empty headers. The `mapper.ts` includes defensive checks for `undefined` headers.
- **No Data in Preview**: Ensure the "Start Row" is set correctly (1-indexed matching Excel row numbers).
- **Mapping Issues**: If columns aren't auto-detected, use the manual mapping dropdowns.
- **Excel Download Issues**: If Chrome downloads a file without an extension, ensure you are running the project via **Docker** (http://localhost:8080) for correct MIME-type handling.
