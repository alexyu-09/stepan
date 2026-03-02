# СТЕПАН: Конвертер Прайсов — Документация Проекта

## Обзор проекта
Это веб-утилита, разработанная для управления данными поставщиков и автоматизации рутины. Приложение полностью локализовано на русский язык и включает два основных модуля:
1. **Конвертер Прайсов**: Стандартизация прайс-листов Excel/CSV с автоматической генерацией SKU, Алиасов и переводами (RU/UA).
2. **Мониторинг Наличия**: Отслеживание изменений в Google Таблицах в реальном времени с уведомлениями в Telegram.

## Технологический стек
- **Framework**: React 19 (Vite + TypeScript)
- **Styling**: Vanilla CSS (Современная эстетика, Glassmorphism, Анимации)
- **Инфраструктура**: Vercel (Хостинг + Serverless Functions + Cron Jobs)
- **Безопасность**: Защищенная авторизация на стороне сервера (Password Protection)
- **База данных**:
  - **Supabase (PostgreSQL)**: Хранение настроек мониторинга, снимков наличия и глобальных конфигов.
  - **IndexedDB**: Локальное хранилище браузера для Конвертера (сессии и история).
- **Библиотеки**:
  - `xlsx`, `papaparse`: Парсинг и экспорт данных.
  - `lucide-react`: Иконография.
  - `translate`: Машинный перевод (Google engine).
  - `@supabase/supabase-js`: Интеграция с облачной БД.

## Функционал и Логика

### 1. Генерация SKU (Артикул) и Алиасов
Логика описана в `src/utils/generators.ts`.
- **Очистка SKU**: Автоматическое удаление служебных слов (аккумулятор, регулятор и т.д.) для создания чистых артикулов.
- **Алиасы (Slug)**: Транслитерация кириллицы в латиницу для SEO-дружелюбных ссылок.
- **Перевод (RU ↔ UA)**: Встроенная система перевода с кешированием (`translationCache`), минимизирующая запросы к API.
- **Маркетинговые примечания**: Каждая строка автоматически дополняется стандартизированными HTML-блоками (желтая плашка) в полях `Примітках`.
- **Значения по умолчанию**: Авто-заполнение полей "Состояние товара" (Новое) и "Отображать" (1).

### 2. Безопасность и Авторизация
- **Защита паролем**: Вход в систему закрыт стильным экраном авторизации (`src/components/Auth.tsx`).
- **Серверная проверка**: Пароль проверяется через Serverless функцию `api/auth.ts` на стороне Vercel. Это исключает возможность обхода защиты через консоль браузера.
- **Сессия**: После успешного входа токен сохраняется в `localStorage`, избавляя от повторного ввода пароля.

### 2. Manual Data Editing
Interactive editing directly in the results table:
- **Inline Editing**: Single-click any cell in the results table to modify its value. Hovering over a cell shows an edit icon and highlight for clarity.
- **Category Selection**: The "Category" column (10th column) uses a specialized dropdown menu with values from a centralized registry (`src/constants/categories.ts`).
- **Bulk Updates**: Pencil icon in the column header allows applying a single value (or choosing from a dropdown if it's the category column) to an entire column.

### 3. Поиск и Назначение Изображений
- **Автоматический поиск**: При нажатии 🔍 система автоматически ищет изображения товара через серверный API (`api/search-images.ts`), показывая до 8 результатов в визуальной сетке.
- **Выбор в один клик**: Нажатие на изображение мгновенно сохраняет его с правильным именем `{SKU}.jpg` и записывает в колонку «Фото» (индекс 17).
- **Ручной ввод URL**: Возможность вставить прямую ссылку на изображение, если автопоиск не нашёл нужного результата.
- **Прокси для изображений**: Серверная функция `api/proxy-image.ts` обходит CORS-ограничения при скачивании изображений.
- **Галерея сохранённых (Шаг 4)**: Все выбранные изображения отображаются в секции «Шаг 4» под обработанными данными. Каждое можно скачать отдельно или нажать «Скачать все (ZIP)» для получения архива всех изображений.
- **ZIP-архив**: Используется библиотека `jszip` для создания архива `product-images_{дата}.zip` со всеми сохранёнными фотографиями.

### 4. Session Persistence & History
- **Auto-save**: All edits are automatically saved to the browser's IndexedDB. Refreshing the page doesn't lose data.
- **History Modal**: Access previous versions of your price lists. You can restore a past session or delete old ones to save space.
- **Mapping Cache**: The system remembers your start row and column mapping for each file.

### 6. Мониторинг Наличия и Уведомления
- **Облачный Backend (Supabase)**: Все настройки трекеров и снимки данных синхронизируются через облако.
- **Изменения**: Система находит новые товары (🟢), закончившиеся (🔴) и те, чье состояние изменилось (🟡).
- **Telegram Уведомления**: Моментальные алерты через бота.
- **Облачный Автопилот (Cron)**: 
  - **Расписание**: Скрипт `api/check-inventory.ts` запускается автоматически каждый день в **09:00 (по Киеву)**.
  - **Резервный таймер**: В UI предусмотрен браузерный таймер для проверки, если вкладка открыта.

## Интерфейс и Пользовательский путь
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
- **Мониторинг**: Запуск ручных проверок или использование автопилота.
- **История**: Просмотр прошлых снимков и логов изменений для каждой таблицы.

## API и Серверная часть
- `api/check-inventory.ts`: Логика облачного автопилота.
- `api/auth.ts`: Серверная проверка пароля.
- `api/search-images.ts`: Поиск изображений товаров (DuckDuckGo + Google fallback).
- `api/proxy-image.ts`: Прокси для скачивания изображений (обход CORS).
- `vercel.json`: Конфигурация Cron-задач и маршрутизации.

## Основные файлы
- `src/main.tsx`: Оболочка приложения (Shell) с навигацией и защитой.
- `src/components/Auth.tsx`: Экран авторизации (дизайн и логика входа).
- `src/App.tsx`: Модуль Конвертера.
- `src/components/InventoryTracker.tsx`: Модуль Мониторинга.
- `src/utils/inventoryStorage.ts`: Логика взаимодействия с Supabase.
- `src/utils/mapper.ts`: Асинхронный маппинг в 44-колоночный формат.
- `src/utils/generators.ts`: Генерация SKU/Alias и Кеш перевода.

## Переменные окружения (Environment Variables)
Required for deployment and local development (see `.env`):
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`: Доступ к базе данных.
- `SUPABASE_SERVICE_ROLE_KEY`: Сервисный ключ для работы Cron-задач (Vercel).
- `APP_PASSWORD`: Главный пароль от приложения (задается в Vercel).

## Решение проблем (Troubleshooting)
- **Black Screen / Red Error**: Usually caused by malformed files with empty headers. The `mapper.ts` includes defensive checks for `undefined` headers.
- **No Data in Preview**: Ensure the "Start Row" is set correctly (1-indexed matching Excel row numbers).
- **Mapping Issues**: If columns aren't auto-detected, use the manual mapping dropdowns.
- **Excel Download Issues**: If Chrome downloads a file without an extension, ensure you are running the project via **Docker** (http://localhost:8080) for correct MIME-type handling.
