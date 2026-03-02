import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req: any, res: any) {
    console.log('Starting automated inventory check...');

    try {
        // 1. Get Settings
        const { data: settings, error: settingsError } = await supabase
            .from('tracker_settings')
            .select('*')
            .eq('id', 'main')
            .single();

        if (settingsError || !settings) {
            console.error('Settings not found');
            return res.status(500).json({ error: 'Settings not configured' });
        }

        // 2. Get all trackers
        const { data: trackers, error: trackersError } = await supabase
            .from('inventory_trackers')
            .select('*');

        if (trackersError) throw trackersError;
        if (!trackers || trackers.length === 0) {
            return res.status(200).json({ message: 'No trackers found' });
        }

        const stats = { checked: 0, notificationsSent: 0, errors: 0 };

        // 3. Process each tracker
        for (const tracker of trackers) {
            try {
                // Fetch new data
                const newData = await fetchSheetData(tracker);

                // Get last snapshot
                const { data: lastSnapshot } = await supabase
                    .from('inventory_snapshots')
                    .select('*')
                    .eq('tracker_id', tracker.id)
                    .order('timestamp', { ascending: false })
                    .limit(1)
                    .single();

                // Save new snapshot
                const timestamp = Date.now();
                await supabase.from('inventory_snapshots').insert({
                    id: `${tracker.id}_${timestamp}`,
                    tracker_id: tracker.id,
                    timestamp,
                    data: newData
                });

                // Update tracker last_checked
                await supabase.from('inventory_trackers')
                    .update({ last_checked: timestamp })
                    .eq('id', tracker.id);

                // Detect changes and notify
                if (lastSnapshot && settings.telegram_bot_token && settings.telegram_chat_id) {
                    const changes = detectChanges(lastSnapshot.data, newData);
                    if (changes.length > 0) {
                        const sent = await sendTelegramNotification(
                            settings.telegram_bot_token,
                            settings.telegram_chat_id,
                            changes,
                            tracker.sheet_name
                        );
                        if (sent) stats.notificationsSent++;
                    }
                }
                stats.checked++;
            } catch (err) {
                console.error(`Error checking ${tracker.sheet_name}:`, err);
                stats.errors++;
            }
        }

        return res.status(200).json({ message: 'Sync complete', stats });
    } catch (error: any) {
        console.error('Global error:', error);
        return res.status(500).json({ error: error.message });
    }
}

// --- Helper Functions (Copied for standalone execution) ---

async function fetchSheetData(tracker: any) {
    const gidParam = tracker.gid ? `&gid=${tracker.gid}` : '';
    const exportUrl = `https://docs.google.com/spreadsheets/d/${tracker.sheet_id}/export?format=csv${gidParam}`;

    const response = await fetch(exportUrl);
    if (!response.ok) throw new Error('Failed to fetch sheet');

    const csvText = await response.text();
    const rows = parseCSV(csvText);

    const nameColIdx = columnLetterToIndex(tracker.name_column);
    const availColIdx = columnLetterToIndex(tracker.availability_column);

    const result: any[] = [];
    for (let i = tracker.start_row - 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const name = String(row[nameColIdx] || '').trim();
        const availability = String(row[availColIdx] || '').trim();
        if (name) result.push({ row: i + 1, name, availability });
    }
    return result;
}

function parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        if (inQuotes) {
            if (char === '"' && nextChar === '"') { currentField += '"'; i++; }
            else if (char === '"') inQuotes = false;
            else currentField += char;
        } else {
            if (char === '"') inQuotes = true;
            else if (char === ',') { currentRow.push(currentField); currentField = ''; }
            else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
                currentRow.push(currentField); currentField = ''; rows.push(currentRow); currentRow = [];
                if (char === '\r') i++;
            } else if (char === '\r') {
                currentRow.push(currentField); currentField = ''; rows.push(currentRow); currentRow = [];
            } else currentField += char;
        }
    }
    if (currentField || currentRow.length > 0) { currentRow.push(currentField); rows.push(currentRow); }
    return rows;
}

function columnLetterToIndex(letter: string): number {
    let index = 0;
    const upper = letter.toUpperCase();
    for (let i = 0; i < upper.length; i++) index = index * 26 + (upper.charCodeAt(i) - 64);
    return index - 1;
}

function detectChanges(oldData: any[], newData: any[]) {
    const changes: any[] = [];
    const oldMap = new Map();
    for (const item of oldData) oldMap.set(item.name, { row: item.row, availability: item.availability });
    for (const item of newData) {
        const old = oldMap.get(item.name);
        if (old && old.availability !== item.availability) {
            changes.push({ row: item.row, name: item.name, oldValue: old.availability, newValue: item.availability });
        }
    }
    return changes;
}

async function sendTelegramNotification(botToken: string, chatId: string, changes: any[], sheetName: string) {
    let message = `📦 *Зміна наявності: ${escapeMarkdown(sheetName)}*\n`;
    message += `🕐 ${new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}\n\n`;
    const maxItems = 30;
    for (const change of changes.slice(0, maxItems)) {
        const emoji = getAvailabilityEmoji(change.oldValue, change.newValue);
        message += `${emoji} *${escapeMarkdown(change.name)}*\n`;
        message += `   _${escapeMarkdown(change.oldValue)}_ → *${escapeMarkdown(change.newValue)}*\n\n`;
    }
    if (changes.length > maxItems) message += `\n... і ще ${changes.length - maxItems} змін`;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
    });
    const result = await response.json();
    return result.ok === true;
}

function escapeMarkdown(text: string): string {
    return text.replace(/[_*\[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

function getAvailabilityEmoji(oldVal: string, newVal: string): string {
    const oldLower = oldVal.toLowerCase();
    const newLower = newVal.toLowerCase();
    const outOfStockTerms = ['нет', 'ні', '0', '', '-', 'out', 'немає'];
    const inStockTerms = ['да', 'є', 'yes', 'в наличии', 'в наявності', 'есть'];
    const wasInStock = !outOfStockTerms.includes(oldLower) || inStockTerms.some(t => oldLower.includes(t));
    const isNowInStock = !outOfStockTerms.includes(newLower) || inStockTerms.some(t => newLower.includes(t));
    if (!wasInStock && isNowInStock) return '🟢';
    if (wasInStock && !isNowInStock) return '🔴';
    return '🟡';
}
