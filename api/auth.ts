const APP_PASSWORD = process.env.APP_PASSWORD || 'Stepan2026!#';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Пароль обязателен' });
    }

    if (password === APP_PASSWORD) {
        // Выдаем простой токен (в идеале здесь JWT, но для нашей задачи достаточно хеша)
        return res.status(200).json({
            success: true,
            token: Buffer.from(APP_PASSWORD + '-v1').toString('base64')
        });
    }

    return res.status(401).json({ error: 'Неверный пароль' });
}
