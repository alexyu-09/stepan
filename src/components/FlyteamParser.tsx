import { useState, useEffect } from 'react';
import { Download, RefreshCw, Search, Database } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface Category {
    name: string;
    url: string;
}

interface Product {
    id: string;
    url: string;
    category: string;
    sku: string;
    name: string;
    price: string;
    availability: string;
    image_url: string;
    updated_at: string;
}

interface TrackChange {
    id: string;
    url: string;
    name: string;
    oldAvailability: string;
    newAvailability: string;
    oldPrice: string;
    newPrice: string;
}

export default function FlyteamParser() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [log, setLog] = useState<string[]>([]);

    const [products, setProducts] = useState<Product[]>([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [changes, setChanges] = useState<TrackChange[]>([]);

    // Load products from DB on mount
    useEffect(() => {
        fetchProductsFromDB();
    }, []);

    const addLog = (msg: string) => {
        setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
    };

    const fetchProductsFromDB = async () => {
        try {
            setIsLoadingProducts(true);
            const { data, error } = await supabase
                .from('flyteam_products')
                .select('*')
                .order('updated_at', { ascending: false });

            if (error) throw error;
            setProducts(data || []);
        } catch (err: any) {
            console.error('Error fetching from DB', err);
        } finally {
            setIsLoadingProducts(false);
        }
    };

    const fetchCategories = async () => {
        try {
            setIsLoading(true);
            addLog('Загрузка категорий...');
            const res = await fetch('/api/flyteam/parse-categories');
            const data = await res.json();

            if (data.categories) {
                setCategories(data.categories);
                addLog(`Найдено ${data.categories.length} категорий.`);
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (err: any) {
            addLog(`Ошибка: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const scrapeCategory = async (url: string, categoryName: string) => {
        addLog(`Начало сбора товаров из: ${categoryName}`);

        let currentUrl: string = url;
        let allProducts: any[] = [];
        let pageNum = 1;

        while (currentUrl) {
            addLog(`Сбор каталога (страница ${pageNum})...`);
            const catalogRes = await fetch('/api/flyteam/parse-catalog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: currentUrl })
            });
            const catalogData = await catalogRes.json();

            if (!catalogData.products) {
                addLog(`Ошибка каталога: ${catalogData.error || 'Unknown'}`);
                break;
            }

            allProducts = [...allProducts, ...catalogData.products];
            currentUrl = catalogData.nextPage || '';
            pageNum++;

            if (currentUrl) {
                await new Promise(r => setTimeout(r, 400));
            }
        }

        addLog(`Найдено ${allProducts.length} товаров. Начинаю детальный сбор...`);

        let successCount = 0;
        for (const p of allProducts) {
            addLog(`Парсинг: ${p.name}`);
            try {
                const prodRes = await fetch('/api/flyteam/parse-product', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: p.url })
                });
                const prodData = await prodRes.json();

                if (prodData.product) {
                    const dbProduct = {
                        ...prodData.product,
                        category: categoryName
                    };

                    const { error: dbErr } = await supabase
                        .from('flyteam_products')
                        .upsert(dbProduct, { onConflict: 'url' });

                    if (dbErr) {
                        addLog(`Ошибка сохранения ${p.name}: ${dbErr.message}`);
                    } else {
                        successCount++;
                    }
                }
            } catch (err: any) {
                addLog(`Ошибка на товаре ${p.name}: ${err.message}`);
            }

            await new Promise(r => setTimeout(r, 500));
        }

        addLog(`Успешно сохранено товаров (${categoryName}): ${successCount}`);
    };

    const parseSelectedCategory = async () => {
        if (!selectedCategory) {
            addLog('Выберите категорию!');
            return;
        }

        try {
            setIsLoading(true);
            const cat = categories.find(c => c.url === selectedCategory);
            await scrapeCategory(selectedCategory, cat?.name || selectedCategory);
            fetchProductsFromDB();
        } catch (err: any) {
            addLog(`Ошибка: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const parseAllCategories = async () => {
        if (categories.length === 0) {
            addLog('Сначала загрузите категории!');
            return;
        }

        if (!confirm('Вы уверены? Это может занять много времени.')) return;

        try {
            setIsLoading(true);
            for (const cat of categories) {
                // Ignore "Все" or parent categories if we want, but letting them run is fine
                // Actually they might duplicate, upsert handles duplicate urls
                await scrapeCategory(cat.url, cat.name);
            }
            addLog('Сбор по всем категориям завершен!');
            fetchProductsFromDB();
        } catch (err: any) {
            addLog(`Ошибка: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const trackChanges = async () => {
        try {
            setIsLoading(true);
            setChanges([]);
            addLog('Запуск проверки наличия...');
            const res = await fetch('/api/flyteam/track-changes', { method: 'POST' });
            const data = await res.json();

            if (data.changes) {
                setChanges(data.changes);
                addLog(data.message || `Найдено изменений: ${data.changes.length}`);
                fetchProductsFromDB();
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (err: any) {
            addLog(`Ошибка трекинга: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="section" style={{ minHeight: '80vh' }}>
            <div className="section-header">
                <h2 className="section-title">
                    <Database size={24} className="text-primary" />
                    Скрейпер Flyteam
                </h2>
                <p className="section-subtitle">Автоматический сбор каталога и синхронизация наличия</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* Left Column: Actions */}
                <div className="card">
                    <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Управление сбором</h3>

                    <div className="action-row" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                        <button className="btn btn-secondary" onClick={fetchCategories} disabled={isLoading}>
                            <Search size={16} /> 1. Загрузить категории
                        </button>
                    </div>

                    {categories.length > 0 && (
                        <>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <select
                                    className="input"
                                    style={{ flexGrow: 1 }}
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                >
                                    <option value="">-- Выберите категорию --</option>
                                    {categories.map(c => (
                                        <option key={c.url} value={c.url}>{c.name}</option>
                                    ))}
                                </select>
                                <button className="btn btn-primary" onClick={parseSelectedCategory} disabled={isLoading || !selectedCategory}>
                                    <Download size={16} /> Собрать одну
                                </button>
                            </div>

                            <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                                <button className="btn" style={{ backgroundColor: '#2563eb', color: '#fff', width: '100%' }} onClick={parseAllCategories} disabled={isLoading}>
                                    <Database size={16} /> 3. Выкачать ВСЕ категории
                                </button>
                            </div>
                        </>
                    )}

                    <div className="action-row" style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
                        <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Трекинг в реальном времени</h3>
                        <button className="btn" style={{ backgroundColor: '#f59e0b', color: '#fff' }} onClick={trackChanges} disabled={isLoading}>
                            <RefreshCw size={16} /> Отследить изменения (Все товары в БД)
                        </button>
                    </div>
                </div>

                {/* Right Column: Console Log */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Лог операций</h3>
                    <div className="input" style={{ flexGrow: 1, minHeight: '250px', maxHeight: '400px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.9rem', backgroundColor: '#0f172a', padding: '1rem' }}>
                        {log.length === 0 ? <span style={{ opacity: 0.5 }}>Ожидание действий...</span> : (
                            log.map((l, idx) => <div key={idx} style={{ marginBottom: '0.5rem', color: l.includes('Ошибка') ? '#ef4444' : '#10b981' }}>{l}</div>)
                        )}
                    </div>
                </div>
            </div>

            {
                changes.length > 0 && (
                    <div className="card" style={{ marginTop: '2rem', borderLeft: '4px solid #f59e0b' }}>
                        <h3 style={{ marginBottom: '1rem', fontWeight: 600, color: '#f59e0b' }}>Изменения после проверки:</h3>
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                            {changes.map((c, i) => (
                                <div key={i} style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '6px', fontSize: '0.9rem' }}>
                                    <strong>{c.name}</strong><br />
                                    <span style={{ color: '#9ca3af' }}>Наличие:</span> <span style={{ textDecoration: 'line-through' }}>{c.oldAvailability || '–'}</span> ➔ <strong style={{ color: '#10b981' }}>{c.newAvailability}</strong>
                                    {c.oldPrice !== c.newPrice && (
                                        <><br /><span style={{ color: '#9ca3af' }}>Цена:</span> <span style={{ textDecoration: 'line-through' }}>{c.oldPrice || '–'}</span> ➔ <strong style={{ color: '#3b82f6' }}>{c.newPrice}</strong></>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            {/* Database Table */}
            <div className="card fade-in" style={{
                marginTop: '2.5rem',
                borderTop: products.length > 0 ? '4px solid var(--success)' : '4px solid var(--primary)',
                background: products.length > 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(81, 90, 218, 0.03)',
                padding: '1.5rem 0'
            }}>
                <div style={{ padding: '0 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ background: products.length > 0 ? 'var(--success)' : 'var(--primary)', padding: '8px', borderRadius: '8px', display: 'flex' }}>
                            <Database size={20} color="#fff" />
                        </div>
                        <h3 style={{ margin: 0 }}>База спарсенных товаров</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {products.length > 0 && <span className="tag" style={{ background: 'var(--success)', color: '#fff' }}>{products.length} товаров в базе</span>}
                        <button className="btn btn-secondary" onClick={fetchProductsFromDB} disabled={isLoadingProducts}>
                            <RefreshCw size={14} className={isLoadingProducts ? 'rotating' : ''} /> Обновить БД
                        </button>
                    </div>
                </div>

                <div style={{ padding: '0 2rem' }}>
                    <div className="section-divider">
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--success)' }}>СОХРАНЕННЫЕ ДАННЫЕ</span>
                    </div>

                    <div className="table-container" style={{ maxHeight: '500px', overflowX: 'auto' }}>
                        <table className="fixed-table" style={{ width: '1200px' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '60px', minWidth: '60px', textAlign: 'center' }}>Фото</th>
                                    <th style={{ width: '120px', minWidth: '120px' }}>Артикул</th>
                                    <th className="sticky-name-col" style={{ width: '400px', minWidth: '400px' }}>Название</th>
                                    <th style={{ width: '150px', minWidth: '150px' }}>Категория</th>
                                    <th style={{ width: '150px', minWidth: '150px' }}>Наличие</th>
                                    <th style={{ width: '100px', minWidth: '100px' }}>Цена</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Нет данных в базе</td></tr>
                                ) : (
                                    products.map((p) => (
                                        <tr key={p.id}>
                                            <td style={{ textAlign: 'center', width: '60px', minWidth: '60px' }}>
                                                {p.image_url ? <img src={p.image_url} alt="img" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} /> : '-'}
                                            </td>
                                            <td style={{ width: '120px', minWidth: '120px' }}>
                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {p.sku ? <span className="tag tag-sku">{p.sku}</span> : '-'}
                                                </div>
                                            </td>
                                            <td className="sticky-name-col cell-name" style={{ width: '400px', minWidth: '400px' }}>
                                                <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{p.name}</a>
                                            </td>
                                            <td style={{ width: '150px', minWidth: '150px' }}>
                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {p.category || '-'}
                                                </div>
                                            </td>
                                            <td style={{ width: '150px', minWidth: '150px' }}>
                                                <span className={`status-badge ${p.availability?.includes('Немає') ? 'status-missing' : 'status-new'}`}>
                                                    {p.availability || 'Неизвестно'}
                                                </span>
                                            </td>
                                            <td style={{ fontWeight: 600, width: '100px', minWidth: '100px' }}>
                                                {p.price || '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
