import { supabase } from '../lib/supabaseClient';

const TRACKER_TABLE = 'inventory_trackers';
const SNAPSHOT_TABLE = 'inventory_snapshots';
const SETTINGS_TABLE = 'tracker_settings';

export interface TrackedSheet {
    id: string;
    sheetUrl: string;
    sheetId: string; // extracted from URL
    gid: string;
    sheetName: string; // user-defined label
    nameColumn: string; // e.g. "B"
    availabilityColumn: string; // e.g. "G"
    startRow: number; // where data starts (1-indexed)
    createdAt: number;
    lastChecked: number | null;
}

export interface InventorySnapshot {
    id: string; // trackerId + timestamp
    trackerId: string;
    timestamp: number;
    data: { row: number; name: string; availability: string }[];
}

export interface InventoryChange {
    row: number;
    name: string;
    oldValue: string;
    newValue: string;
}

export interface TrackerSettings {
    id: string; // always 'main'
    telegramBotToken: string;
    telegramChatId: string;
    checkTimes: string[]; // e.g. ["09:00", "16:00"]
    timezone: string; // e.g. "Europe/Kyiv"
}

// Check if Supabase is properly configured
const isSupabaseReady = () => {
    return !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
};

// --- Tracker CRUD ---
export const saveTracker = async (tracker: TrackedSheet): Promise<void> => {
    if (!isSupabaseReady()) {
        console.error('Supabase not configured');
        return;
    }
    const { error } = await supabase
        .from(TRACKER_TABLE)
        .upsert({
            id: tracker.id,
            sheet_url: tracker.sheetUrl,
            sheet_id: tracker.sheetId,
            gid: tracker.gid,
            sheet_name: tracker.sheetName,
            name_column: tracker.nameColumn,
            availability_column: tracker.availabilityColumn,
            start_row: tracker.startRow,
            created_at: tracker.createdAt,
            last_checked: tracker.lastChecked
        });
    if (error) throw error;
};

export const getTrackers = async (): Promise<TrackedSheet[]> => {
    if (!isSupabaseReady()) return [];
    const { data, error } = await supabase
        .from(TRACKER_TABLE)
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(d => ({
        id: d.id,
        sheetUrl: d.sheet_url,
        sheetId: d.sheet_id,
        gid: d.gid,
        sheetName: d.sheet_name,
        nameColumn: d.name_column,
        availabilityColumn: d.availability_column,
        startRow: d.start_row,
        createdAt: Number(d.created_at),
        lastChecked: d.last_checked ? Number(d.last_checked) : null
    }));
};

export const deleteTracker = async (id: string): Promise<void> => {
    if (!isSupabaseReady()) return;
    const { error } = await supabase
        .from(TRACKER_TABLE)
        .delete()
        .eq('id', id);
    if (error) throw error;
};

// --- Snapshots ---
export const saveSnapshot = async (snapshot: InventorySnapshot): Promise<void> => {
    if (!isSupabaseReady()) return;
    const { error } = await supabase
        .from(SNAPSHOT_TABLE)
        .upsert({
            id: snapshot.id,
            tracker_id: snapshot.trackerId,
            timestamp: snapshot.timestamp,
            data: snapshot.data
        });
    if (error) throw error;
};

export const getLatestSnapshot = async (trackerId: string): Promise<InventorySnapshot | null> => {
    if (!isSupabaseReady()) return null;
    const { data, error } = await supabase
        .from(SNAPSHOT_TABLE)
        .select('*')
        .eq('tracker_id', trackerId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is code for no results
    if (!data) return null;

    return {
        id: data.id,
        trackerId: data.tracker_id,
        timestamp: Number(data.timestamp),
        data: data.data
    };
};

export const getSnapshotsForTracker = async (trackerId: string): Promise<InventorySnapshot[]> => {
    if (!isSupabaseReady()) return [];
    const { data, error } = await supabase
        .from(SNAPSHOT_TABLE)
        .select('*')
        .eq('tracker_id', trackerId)
        .order('timestamp', { ascending: false });

    if (error) throw error;

    return (data || []).map(d => ({
        id: d.id,
        trackerId: d.tracker_id,
        timestamp: Number(d.timestamp),
        data: d.data
    }));
};

// --- Settings ---
export const saveSettings = async (settings: TrackerSettings): Promise<void> => {
    if (!isSupabaseReady()) return;
    const { error } = await supabase
        .from(SETTINGS_TABLE)
        .upsert({
            id: 'main',
            telegram_bot_token: settings.telegramBotToken,
            telegram_chat_id: settings.telegramChatId,
            check_times: settings.checkTimes,
            timezone: settings.timezone
        });
    if (error) throw error;
};

export const getSettings = async (): Promise<TrackerSettings | null> => {
    if (!isSupabaseReady()) return null;
    const { data, error } = await supabase
        .from(SETTINGS_TABLE)
        .select('*')
        .eq('id', 'main')
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return {
        id: data.id,
        telegramBotToken: data.telegram_bot_token,
        telegramChatId: data.telegram_chat_id,
        checkTimes: data.check_times,
        timezone: data.timezone
    };
};

// --- Google Sheets fetching ---
export const columnLetterToIndex = (letter: string): number => {
    let index = 0;
    const upper = letter.toUpperCase();
    for (let i = 0; i < upper.length; i++) {
        index = index * 26 + (upper.charCodeAt(i) - 64);
    }
    return index - 1; // 0-based
};

export const fetchSheetData = async (tracker: TrackedSheet): Promise<{ row: number; name: string; availability: string }[]> => {
    const gidParam = tracker.gid ? `&gid=${tracker.gid}` : '';
    const exportUrl = `https://docs.google.com/spreadsheets/d/${tracker.sheetId}/export?format=csv${gidParam}`;

    const response = await fetch(exportUrl);
    if (!response.ok) throw new Error('Не удалось загрузить Google Sheet. Убедитесь, что данные доступны по ссылке.');

    const csvText = await response.text();

    // Parse CSV manually to handle properly 
    const rows = parseCSV(csvText);

    const nameColIdx = columnLetterToIndex(tracker.nameColumn);
    const availColIdx = columnLetterToIndex(tracker.availabilityColumn);

    const result: { row: number; name: string; availability: string }[] = [];

    for (let i = tracker.startRow - 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const name = String(row[nameColIdx] || '').trim();
        const availability = String(row[availColIdx] || '').trim();
        if (name) {
            result.push({ row: i + 1, name, availability });
        }
    }

    return result;
};

// Simple CSV parser that handles quoted fields
const parseCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                currentField += '"';
                i++; // skip next quote
            } else if (char === '"') {
                inQuotes = false;
            } else {
                currentField += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                currentRow.push(currentField);
                currentField = '';
            } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
                currentRow.push(currentField);
                currentField = '';
                rows.push(currentRow);
                currentRow = [];
                if (char === '\r') i++; // skip \n
            } else if (char === '\r') {
                currentRow.push(currentField);
                currentField = '';
                rows.push(currentRow);
                currentRow = [];
            } else {
                currentField += char;
            }
        }
    }

    // Last field/row
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
    }

    return rows;
};

// --- Diff / Change Detection ---
export const detectChanges = (
    oldData: { row: number; name: string; availability: string }[],
    newData: { row: number; name: string; availability: string }[]
): InventoryChange[] => {
    const changes: InventoryChange[] = [];

    // Build map from old data by name (since rows may shift)
    const oldMap = new Map<string, { row: number; availability: string }>();
    for (const item of oldData) {
        oldMap.set(item.name, { row: item.row, availability: item.availability });
    }

    for (const item of newData) {
        const old = oldMap.get(item.name);
        if (old && old.availability !== item.availability) {
            changes.push({
                row: item.row,
                name: item.name,
                oldValue: old.availability,
                newValue: item.availability,
            });
        }
    }

    return changes;
};

// --- Telegram notification ---
export const sendTelegramNotification = async (
    botToken: string,
    chatId: string,
    changes: InventoryChange[],
    sheetName: string
): Promise<boolean> => {
    if (!botToken || !chatId || changes.length === 0) return false;

    let message = `📦 *Зміна наявності: ${escapeMarkdown(sheetName)}*\n`;
    message += `🕐 ${new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}\n\n`;

    const maxItems = 30; // Telegram has message length limit
    const showChanges = changes.slice(0, maxItems);

    for (const change of showChanges) {
        const emoji = getAvailabilityEmoji(change.oldValue, change.newValue);
        message += `${emoji} *${escapeMarkdown(change.name)}*\n`;
        message += `   _${escapeMarkdown(change.oldValue)}_ → *${escapeMarkdown(change.newValue)}*\n\n`;
    }

    if (changes.length > maxItems) {
        message += `\n... і ще ${changes.length - maxItems} змін`;
    }

    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown',
            }),
        });

        const result = await response.json();
        return result.ok === true;
    } catch (err) {
        console.error('Telegram send failed:', err);
        return false;
    }
};

const escapeMarkdown = (text: string): string => {
    return text.replace(/[_*\[\]()~`>#+=|{}.!\\-]/g, '\\$&');
};

const getAvailabilityEmoji = (oldVal: string, newVal: string): string => {
    const oldLower = oldVal.toLowerCase();
    const newLower = newVal.toLowerCase();

    // Detect "in stock" -> "out of stock" type changes
    const outOfStockTerms = ['нет', 'ні', '0', '', '-', 'out', 'немає'];
    const inStockTerms = ['да', 'є', 'yes', 'в наличии', 'в наявності', 'есть'];

    const wasInStock = !outOfStockTerms.includes(oldLower) || inStockTerms.some(t => oldLower.includes(t));
    const isNowInStock = !outOfStockTerms.includes(newLower) || inStockTerms.some(t => newLower.includes(t));

    if (!wasInStock && isNowInStock) return '🟢'; // Became available
    if (wasInStock && !isNowInStock) return '🔴'; // Became unavailable
    return '🟡'; // Changed but unclear direction
};
