import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Globe, Plus, Trash2, X, Settings, Bell, RefreshCw, Eye, Clock,
    CheckCircle, AlertTriangle, Send, ChevronDown, ChevronUp, FileText,
    ArrowRightLeft, Activity
} from 'lucide-react';
import {
    type TrackedSheet, type TrackerSettings, type InventoryChange, type InventorySnapshot,
    saveTracker, getTrackers, deleteTracker,
    saveSettings, getSettings,
    saveSnapshot, getLatestSnapshot, getSnapshotsForTracker,
    fetchSheetData, detectChanges, sendTelegramNotification,
} from '../utils/inventoryStorage';

// --- Helper: extract sheet ID and GID from Google Sheets URL ---
const parseSheetUrl = (url: string): { sheetId: string; gid: string } | null => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return null;
    const gidMatch = url.match(/gid=([0-9]+)/);
    return { sheetId: match[1], gid: gidMatch ? gidMatch[1] : '0' };
};

// --- Sub-component: Add Tracker Modal ---
const AddTrackerModal = ({ isOpen, onClose, onSave }: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (tracker: TrackedSheet) => void;
}) => {
    const [url, setUrl] = useState('');
    const [name, setName] = useState('');
    const [nameCol, setNameCol] = useState('B');
    const [availCol, setAvailCol] = useState('G');
    const [startRow, setStartRow] = useState(2);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSave = () => {
        setError('');
        if (!url.trim()) { setError('Вставьте ссылку на Google Sheet'); return; }
        const parsed = parseSheetUrl(url);
        if (!parsed) { setError('Неверная ссылка Google Sheets'); return; }
        if (!name.trim()) { setError('Введите название'); return; }
        if (!nameCol.trim()) { setError('Укажите столбец названия'); return; }
        if (!availCol.trim()) { setError('Укажите столбец наличия'); return; }

        const tracker: TrackedSheet = {
            id: `tracker_${Date.now()}`,
            sheetUrl: url,
            sheetId: parsed.sheetId,
            gid: parsed.gid,
            sheetName: name,
            nameColumn: nameCol.toUpperCase(),
            availabilityColumn: availCol.toUpperCase(),
            startRow,
            createdAt: Date.now(),
            lastChecked: null,
        };

        onSave(tracker);
        // Reset
        setUrl(''); setName(''); setNameCol('B'); setAvailCol('G'); setStartRow(2); setError('');
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ background: 'var(--primary)', padding: '6px', borderRadius: '6px' }}>
                            <Plus size={18} color="#fff" />
                        </div>
                        <h3 style={{ margin: 0 }}>Добавить отслеживание</h3>
                    </div>
                    <button className="btn-icon" onClick={onClose} style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                <div className="input-group">
                    <label className="input-label">Название (для вас)</label>
                    <input
                        className="input-field"
                        placeholder="Например: Прайс HobbyWing"
                        value={name}
                        onChange={e => setName(e.target.value)}
                    />
                </div>

                <div className="input-group">
                    <label className="input-label">Ссылка на Google Sheet</label>
                    <input
                        className="input-field"
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        Документ должен быть доступен по ссылке (Anyone with the link can view)
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                        <label className="input-label">Столбец названия</label>
                        <input
                            className="input-field"
                            placeholder="B"
                            value={nameCol}
                            onChange={e => setNameCol(e.target.value)}
                            maxLength={2}
                            style={{ textTransform: 'uppercase', textAlign: 'center' }}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Столбец наличия</label>
                        <input
                            className="input-field"
                            placeholder="G"
                            value={availCol}
                            onChange={e => setAvailCol(e.target.value)}
                            maxLength={2}
                            style={{ textTransform: 'uppercase', textAlign: 'center' }}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Начало данных</label>
                        <input
                            className="input-field"
                            type="number"
                            min={1}
                            value={startRow}
                            onChange={e => setStartRow(parseInt(e.target.value) || 1)}
                            style={{ textAlign: 'center' }}
                        />
                    </div>
                </div>

                {error && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem 1rem', borderRadius: '8px', color: 'var(--error)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                        {error}
                    </div>
                )}

                <button className="btn btn-primary" onClick={handleSave} style={{ width: '100%', marginTop: '0.5rem' }}>
                    <Plus size={18} /> Добавить
                </button>
            </div>
        </div>
    );
};

// --- Sub-component: Settings Modal ---
const SettingsModal = ({ isOpen, onClose, settings, onSave }: {
    isOpen: boolean;
    onClose: () => void;
    settings: TrackerSettings;
    onSave: (s: TrackerSettings) => void;
}) => {
    const [botToken, setBotToken] = useState(settings.telegramBotToken);
    const [chatId, setChatId] = useState(settings.telegramChatId);
    const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

    useEffect(() => {
        setBotToken(settings.telegramBotToken);
        setChatId(settings.telegramChatId);
    }, [settings]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave({
            ...settings,
            telegramBotToken: botToken,
            telegramChatId: chatId,
        });
        onClose();
    };

    const handleTestMessage = async () => {
        if (!botToken || !chatId) return;
        setTestStatus('sending');
        try {
            const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: '✅ STEPAN Inventory Tracker: Тестовое сообщение! Бот настроен корректно.',
                    parse_mode: 'Markdown',
                }),
            });
            const result = await res.json();
            setTestStatus(result.ok ? 'success' : 'error');
        } catch {
            setTestStatus('error');
        }
        setTimeout(() => setTestStatus('idle'), 3000);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ background: 'var(--accent)', padding: '6px', borderRadius: '6px' }}>
                            <Settings size={18} color="#fff" />
                        </div>
                        <h3 style={{ margin: 0 }}>Настройки Telegram</h3>
                    </div>
                    <button className="btn-icon" onClick={onClose} style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                <div className="input-group">
                    <label className="input-label">Bot Token</label>
                    <input
                        className="input-field"
                        placeholder="123456:ABC-DEF..."
                        value={botToken}
                        onChange={e => setBotToken(e.target.value)}
                        type="password"
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        Создайте бота через @BotFather и вставьте токен
                    </p>
                </div>

                <div className="input-group">
                    <label className="input-label">Chat ID</label>
                    <input
                        className="input-field"
                        placeholder="-100123456789 или ваш ID"
                        value={chatId}
                        onChange={e => setChatId(e.target.value)}
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        Узнайте свой Chat ID через @userinfobot или @RawDataBot
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                    <button className="btn btn-secondary" onClick={handleTestMessage} disabled={!botToken || !chatId || testStatus === 'sending'} style={{ flex: 1 }}>
                        {testStatus === 'sending' ? <RefreshCw size={16} className="spin-icon" /> :
                            testStatus === 'success' ? <CheckCircle size={16} color="var(--success)" /> :
                                testStatus === 'error' ? <AlertTriangle size={16} color="var(--error)" /> :
                                    <Send size={16} />}
                        {testStatus === 'sending' ? 'Отправка...' :
                            testStatus === 'success' ? 'Отправлено ✓' :
                                testStatus === 'error' ? 'Ошибка!' :
                                    'Тест'}
                    </button>
                    <button className="btn btn-primary" onClick={handleSave} style={{ flex: 2 }}>
                        Сохранить настройки
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Sub-component: Tracker Card ---
const TrackerCard = ({ tracker, settings, onDelete, onUpdate }: {
    tracker: TrackedSheet;
    settings: TrackerSettings;
    onDelete: () => void;
    onUpdate: (t: TrackedSheet) => void;
}) => {
    const [expanded, setExpanded] = useState(false);
    const [checking, setChecking] = useState(false);
    const [lastChanges, setLastChanges] = useState<InventoryChange[]>([]);
    const [previewData, setPreviewData] = useState<{ row: number; name: string; availability: string }[] | null>(null);
    const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'no-changes'>('idle');
    const [statusMsg, setStatusMsg] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [changeHistory, setChangeHistory] = useState<InventorySnapshot[]>([]);

    const checkNow = useCallback(async () => {
        setChecking(true);
        setStatus('idle');
        setStatusMsg('');
        try {
            const newData = await fetchSheetData(tracker);
            setPreviewData(newData);

            const oldSnapshot = await getLatestSnapshot(tracker.id);

            const snapshot: InventorySnapshot = {
                id: `${tracker.id}_${Date.now()}`,
                trackerId: tracker.id,
                timestamp: Date.now(),
                data: newData,
            };
            await saveSnapshot(snapshot);

            const updated = { ...tracker, lastChecked: Date.now() };
            await saveTracker(updated);
            onUpdate(updated);

            if (oldSnapshot) {
                const changes = detectChanges(oldSnapshot.data, newData);
                setLastChanges(changes);

                if (changes.length > 0) {
                    setStatus('success');
                    setStatusMsg(`Найдено ${changes.length} изменений`);

                    // Send Telegram notification
                    if (settings.telegramBotToken && settings.telegramChatId) {
                        const sent = await sendTelegramNotification(
                            settings.telegramBotToken,
                            settings.telegramChatId,
                            changes,
                            tracker.sheetName
                        );
                        if (sent) {
                            setStatusMsg(prev => prev + ' • Telegram ✓');
                        }
                    }
                } else {
                    setStatus('no-changes');
                    setStatusMsg('Изменений не найдено');
                }
            } else {
                setStatus('success');
                setStatusMsg(`Первый снимок: ${newData.length} товаров`);
            }

            // Load change history
            const snapshots = await getSnapshotsForTracker(tracker.id);
            setChangeHistory(snapshots);
        } catch (err) {
            setStatus('error');
            setStatusMsg(err instanceof Error ? err.message : 'Ошибка загрузки');
        } finally {
            setChecking(false);
        }
    }, [tracker, settings, onUpdate]);

    useEffect(() => {
        // Load change history on mount
        getSnapshotsForTracker(tracker.id).then(setChangeHistory);
    }, [tracker.id]);

    return (
        <div className="tracker-card" style={{
            background: 'var(--panel-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            overflow: 'hidden',
            transition: 'all 0.3s ease',
        }}>
            {/* Header */}
            <div
                style={{
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: expanded ? 'rgba(81, 90, 218, 0.05)' : 'transparent',
                    transition: 'background 0.2s',
                }}
                onClick={() => setExpanded(!expanded)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                    <div style={{
                        width: '40px', height: '40px',
                        background: 'linear-gradient(135deg, var(--primary), #7c3aed)',
                        borderRadius: '10px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        <FileText size={20} color="#fff" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.2rem' }}>{tracker.sheetName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <span>📊 {tracker.nameColumn} → {tracker.availabilityColumn}</span>
                            <span>📍 Строка {tracker.startRow}+</span>
                            {tracker.lastChecked && (
                                <span style={{ color: 'var(--success)' }}>
                                    ✓ {new Date(tracker.lastChecked).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                        className="btn btn-primary"
                        onClick={(e) => { e.stopPropagation(); checkNow(); }}
                        disabled={checking}
                        style={{ padding: '8px 16px', fontSize: '0.8rem', gap: '0.4rem' }}
                    >
                        <RefreshCw size={14} className={checking ? 'spin-icon' : ''} />
                        {checking ? 'Проверка...' : 'Проверить'}
                    </button>
                    {expanded ? <ChevronUp size={20} color="var(--text-secondary)" /> : <ChevronDown size={20} color="var(--text-secondary)" />}
                </div>
            </div>

            {/* Status bar */}
            {status !== 'idle' && (
                <div style={{
                    padding: '0.5rem 1.5rem',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: status === 'success' ? 'rgba(16, 185, 129, 0.1)'
                        : status === 'error' ? 'rgba(239, 68, 68, 0.1)'
                            : 'rgba(245, 158, 11, 0.1)',
                    color: status === 'success' ? 'var(--success)'
                        : status === 'error' ? 'var(--error)'
                            : 'var(--accent)',
                    borderTop: '1px solid var(--border-color)',
                }}>
                    {status === 'success' ? <CheckCircle size={14} /> :
                        status === 'error' ? <AlertTriangle size={14} /> :
                            <Activity size={14} />}
                    {statusMsg}
                </div>
            )}

            {/* Expanded content */}
            {expanded && (
                <div style={{ borderTop: '1px solid var(--border-color)', padding: '1.25rem 1.5rem' }} className="fade-in">
                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowPreview(!showPreview)}
                            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                            disabled={!previewData}
                        >
                            <Eye size={14} /> {showPreview ? 'Скрыть данные' : 'Показать данные'}
                        </button>
                        <a
                            href={tracker.sheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ padding: '6px 14px', fontSize: '0.8rem', textDecoration: 'none' }}
                        >
                            <Globe size={14} /> Открыть в Google
                        </a>
                        <button
                            className="btn btn-secondary"
                            onClick={onDelete}
                            style={{ padding: '6px 14px', fontSize: '0.8rem', color: 'var(--error)', marginLeft: 'auto' }}
                        >
                            <Trash2 size={14} /> Удалить
                        </button>
                    </div>

                    {/* Changes */}
                    {lastChanges.length > 0 && (
                        <div style={{ marginBottom: '1.25rem' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <ArrowRightLeft size={14} color="var(--accent)" /> Последние изменения ({lastChanges.length})
                            </div>
                            <div style={{
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '10px',
                                maxHeight: '250px',
                                overflowY: 'auto',
                            }}>
                                {lastChanges.map((ch, i) => (
                                    <div key={i} style={{
                                        padding: '0.6rem 1rem',
                                        borderBottom: i < lastChanges.length - 1 ? '1px solid var(--border-color)' : 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        fontSize: '0.85rem',
                                    }}>
                                        <span style={{ fontSize: '1rem' }}>
                                            {ch.newValue && !ch.oldValue ? '🟢' :
                                                !ch.newValue && ch.oldValue ? '🔴' : '🟡'}
                                        </span>
                                        <span style={{ flex: 1, fontWeight: 500 }}>{ch.name}</span>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            background: 'rgba(239,68,68,0.15)',
                                            color: 'var(--error)',
                                            textDecoration: 'line-through',
                                        }}>
                                            {ch.oldValue || '—'}
                                        </span>
                                        <span style={{ color: 'var(--text-secondary)' }}>→</span>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            background: 'rgba(16,185,129,0.15)',
                                            color: 'var(--success)',
                                            fontWeight: 600,
                                        }}>
                                            {ch.newValue || '—'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Preview data table */}
                    {showPreview && previewData && (
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Eye size={14} color="var(--primary)" /> Текущие данные ({previewData.length} товаров)
                            </div>
                            <div style={{
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '10px',
                                maxHeight: '350px',
                                overflowY: 'auto',
                            }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: '50px', textAlign: 'center', padding: '8px', fontSize: '0.75rem', position: 'sticky', top: 0, background: '#17191e', zIndex: 5 }}>#</th>
                                            <th style={{ padding: '8px', fontSize: '0.75rem', position: 'sticky', top: 0, background: '#17191e', zIndex: 5 }}>Название ({tracker.nameColumn})</th>
                                            <th style={{ width: '150px', padding: '8px', fontSize: '0.75rem', position: 'sticky', top: 0, background: '#17191e', zIndex: 5 }}>Наличие ({tracker.availabilityColumn})</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.slice(0, 100).map((item, i) => (
                                            <tr key={i}>
                                                <td style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '6px 8px' }}>{item.row}</td>
                                                <td style={{ padding: '6px 8px', fontSize: '0.85rem' }}>{item.name}</td>
                                                <td style={{
                                                    padding: '6px 8px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600,
                                                    color: item.availability ? 'var(--success)' : 'var(--text-secondary)',
                                                }}>
                                                    {item.availability || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {previewData.length > 100 && (
                                    <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        Показано 100 из {previewData.length}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* History */}
                    {changeHistory.length > 0 && (
                        <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Clock size={12} /> История проверок ({changeHistory.length})
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {changeHistory.slice(0, 10).map((snap) => (
                                    <span key={snap.id} className="tag" style={{ fontSize: '0.7rem', padding: '3px 8px' }}>
                                        {new Date(snap.timestamp).toLocaleString('uk-UA', {
                                            timeZone: 'Europe/Kyiv',
                                            day: '2-digit', month: '2-digit',
                                            hour: '2-digit', minute: '2-digit'
                                        })}
                                        <span style={{ marginLeft: '4px', opacity: 0.6 }}>({snap.data.length})</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ==============================
// MAIN COMPONENT
// ==============================
const InventoryTracker: React.FC = () => {
    const [trackers, setTrackers] = useState<TrackedSheet[]>([]);
    const [settings, setSettingsState] = useState<TrackerSettings>({
        id: 'main',
        telegramBotToken: '',
        telegramChatId: '',
        checkTimes: ['09:00', '16:00'],
        timezone: 'Europe/Kyiv',
    });
    const [showAddModal, setShowAddModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [autoCheckActive, setAutoCheckActive] = useState(true);
    const [nextCheck, setNextCheck] = useState<string | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load data on mount
    useEffect(() => {
        const init = async () => {
            const t = await getTrackers();
            setTrackers(t.sort((a, b) => b.createdAt - a.createdAt));

            const s = await getSettings();
            if (s) setSettingsState(s);
        };
        init();
    }, []);

    // Auto-check scheduler
    useEffect(() => {
        if (!autoCheckActive || trackers.length === 0) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setNextCheck(null);
            return;
        }

        const calcNextCheck = () => {
            const now = new Date();
            const kyivTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
            const kyivHours = kyivTime.getHours();
            const kyivMinutes = kyivTime.getMinutes();
            const currentMinutes = kyivHours * 60 + kyivMinutes;

            const checkMinutes = settings.checkTimes.map(t => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            }).sort((a, b) => a - b);

            let nextMins = checkMinutes.find(m => m > currentMinutes);
            const isToday = nextMins !== undefined;
            if (!isToday) nextMins = checkMinutes[0]; // tomorrow

            const h = Math.floor(nextMins! / 60);
            const m = nextMins! % 60;
            setNextCheck(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} (Kyiv)${!isToday ? ' завтра' : ''}`);
        };

        calcNextCheck();

        const check = () => {
            const now = new Date();
            const kyivTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
            const timeStr = `${kyivTime.getHours().toString().padStart(2, '0')}:${kyivTime.getMinutes().toString().padStart(2, '0')}`;

            if (settings.checkTimes.includes(timeStr)) {
                console.log(`Auto-check triggered at ${timeStr} Kyiv time`);
                runAutoCheck();
            }

            calcNextCheck();
        };

        // Check every 60 seconds
        intervalRef.current = setInterval(check, 60_000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [autoCheckActive, trackers.length, settings.checkTimes]);

    const runAutoCheck = useCallback(async () => {
        for (const tracker of trackers) {
            try {
                const newData = await fetchSheetData(tracker);
                const oldSnapshot = await getLatestSnapshot(tracker.id);

                const snapshot: InventorySnapshot = {
                    id: `${tracker.id}_${Date.now()}`,
                    trackerId: tracker.id,
                    timestamp: Date.now(),
                    data: newData,
                };
                await saveSnapshot(snapshot);

                const updated = { ...tracker, lastChecked: Date.now() };
                await saveTracker(updated);

                if (oldSnapshot) {
                    const changes = detectChanges(oldSnapshot.data, newData);
                    if (changes.length > 0 && settings.telegramBotToken && settings.telegramChatId) {
                        await sendTelegramNotification(
                            settings.telegramBotToken,
                            settings.telegramChatId,
                            changes,
                            tracker.sheetName
                        );
                    }
                }
            } catch (err) {
                console.error(`Auto-check failed for ${tracker.sheetName}:`, err);
            }
        }

        // Refresh trackers
        const updated = await getTrackers();
        setTrackers(updated.sort((a, b) => b.createdAt - a.createdAt));
    }, [trackers, settings]);

    const handleAddTracker = async (tracker: TrackedSheet) => {
        await saveTracker(tracker);
        setTrackers(prev => [tracker, ...prev]);
        setShowAddModal(false);
    };

    const handleDeleteTracker = async (id: string) => {
        if (!confirm('Удалить отслеживание?')) return;
        await deleteTracker(id);
        setTrackers(prev => prev.filter(t => t.id !== id));
    };

    const handleSaveSettings = async (s: TrackerSettings) => {
        await saveSettings(s);
        setSettingsState(s);
    };

    const handleUpdateTracker = (updated: TrackedSheet) => {
        setTrackers(prev => prev.map(t => t.id === updated.id ? updated : t));
    };

    const handleCheckAll = async () => {
        await runAutoCheck();
    };

    return (
        <div className="container fade-in">
            {/* Header */}
            <div className="card" style={{
                background: 'linear-gradient(135deg, rgba(81, 90, 218, 0.15), rgba(124, 58, 237, 0.1))',
                borderTop: '3px solid var(--primary)',
                marginBottom: '2rem',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h2 style={{ margin: 0, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Activity size={24} color="var(--primary)" />
                            Отслеживание наличия
                        </h2>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Мониторинг Google Sheets с уведомлениями в Telegram
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary" onClick={() => setShowSettingsModal(true)} style={{ gap: '0.4rem' }}>
                            <Bell size={16} /> Telegram
                        </button>
                        <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ gap: '0.4rem' }}>
                            <Plus size={16} /> Добавить
                        </button>
                    </div>
                </div>
            </div>

            {/* Schedule info bar */}
            <div className="card" style={{
                padding: '1rem 1.5rem',
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={16} color="var(--accent)" />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Расписание:</span>
                        {settings.checkTimes.map(time => (
                            <span key={time} className="tag" style={{ background: 'rgba(81, 90, 218, 0.15)', color: 'var(--primary)', fontWeight: 600 }}>
                                {time}
                            </span>
                        ))}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(Kyiv)</span>
                    </div>

                    {nextCheck && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Cloud Autopilot: <span style={{ color: 'var(--success)', fontWeight: 600 }}>Активен</span>
                            <span style={{ marginLeft: '10px' }}>
                                След: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{nextCheck}</span>
                            </span>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginRight: '0.5rem' }}>
                        {autoCheckActive ? '🔔 Авто-проверка включена' : '🔕 Только вручную'}
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                        <input
                            type="checkbox"
                            checked={autoCheckActive}
                            onChange={e => setAutoCheckActive(e.target.checked)}
                            style={{ accentColor: 'var(--primary)' }}
                        />
                        Браузерный таймер (резерв)
                    </label>

                    <button
                        className="btn btn-secondary"
                        onClick={handleCheckAll}
                        disabled={trackers.length === 0}
                        style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                    >
                        <RefreshCw size={14} /> Проверить все
                    </button>
                </div>
            </div>

            {/* Telegram status */}
            {(!settings.telegramBotToken || !settings.telegramChatId) && (
                <div className="card" style={{
                    padding: '1rem 1.5rem',
                    marginBottom: '1.5rem',
                    background: 'rgba(245, 158, 11, 0.08)',
                    borderColor: 'rgba(245, 158, 11, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                }}>
                    <AlertTriangle size={18} color="var(--accent)" />
                    <span style={{ fontSize: '0.9rem', color: 'var(--accent)' }}>
                        Настройте Telegram бота для получения уведомлений
                    </span>
                    <button
                        className="btn btn-secondary"
                        onClick={() => setShowSettingsModal(true)}
                        style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: '0.8rem' }}
                    >
                        Настроить
                    </button>
                </div>
            )}

            {/* Trackers List */}
            {trackers.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <Globe size={56} color="var(--text-secondary)" style={{ opacity: 0.2, marginBottom: '1.5rem' }} />
                    <h3 style={{ color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.5rem' }}>
                        Нет отслеживаемых документов
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                        Добавьте Google Sheet для мониторинга изменений наличия
                    </p>
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        <Plus size={18} /> Добавить первый документ
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {trackers.map(tracker => (
                        <TrackerCard
                            key={tracker.id}
                            tracker={tracker}
                            settings={settings}
                            onDelete={() => handleDeleteTracker(tracker.id)}
                            onUpdate={handleUpdateTracker}
                        />
                    ))}
                </div>
            )}

            {/* Modals */}
            <AddTrackerModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSave={handleAddTracker}
            />
            <SettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                settings={settings}
                onSave={handleSaveSettings}
            />
        </div>
    );
};

export default InventoryTracker;
