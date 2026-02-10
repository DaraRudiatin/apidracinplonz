const express = require('express');
const cors = require('cors');
const NodeCache = require('node-cache');

const { 
    getDramaList, 
    getLatestDrama, 
    getRankDrama, 
    getChannelDrama, 
    getIndoDubbedDrama, 
    getAllDramas,
    fetchAllDramas,
    fetchAllDramasMultiLang,
    SUPPORTED_LANGUAGES,
    scrapeEpisodes, 
    searchDrama, 
    searchSuggest 
} = require('./EnvielDracin');

const app = express();
const cache = new NodeCache({ stdTTL: 300 });

// API Key untuk proteksi
const API_KEY = 'tworuan_dracin_2026_secret_key';

// CORS - hanya izinkan domain tertentu
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173', 
    'https://tworuan.com',
    'https://www.tworuan.com'
];

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('CORS policy: Access denied'), false);
        }
        return callback(null, true);
    }
}));

app.use(express.json());

// Middleware untuk validasi API Key
app.use((req, res, next) => {
    // Skip validation untuk root endpoint
    if (req.path === '/') {
        return next();
    }
    
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey || apiKey !== API_KEY) {
        return res.status(403).json({
            status: false,
            message: 'Forbidden: Invalid or missing API key',
            data: null
        });
    }
    
    next();
});

const sendResponse = (res, result) => {
    if (result.status === 'success') {
        res.json({
            status: true,
            message: 'Success',
            data: result.data
        });
    } else {
        res.status(500).json({
            status: false,
            message: result.message || 'Internal Server Error',
            data: null
        });
    }
};

app.get('/enviel/drama/featured', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 20;
    const result = await getDramaList(page, size);
    sendResponse(res, result);
});

app.get('/enviel/drama/latest', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 20;
    const result = await getLatestDrama(page, size);
    sendResponse(res, result);
});

app.get('/enviel/drama/rank', async (req, res) => {
    const type = parseInt(req.query.type) || 1;
    const result = await getRankDrama(type);
    sendResponse(res, result);
});

app.get('/enviel/drama/channel/:id', async (req, res) => {
    const channelId = parseInt(req.params.id) || 205;
    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 20;
    const result = await getChannelDrama(channelId, page, size);
    sendResponse(res, result);
});

app.get('/enviel/drama/indo', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 20;
    const result = await getIndoDubbedDrama(page, size);
    sendResponse(res, result);
});

app.get('/enviel/drama/all', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; 
    const cacheKey = `drama_all_p${page}_l${limit}`;

    try {
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
            return res.json({
                status: true,
                message: 'Success (Cached)',
                totalFetched: cachedData.length,
                data: cachedData
            });
        }

        const result = await getAllDramas(page, limit);
        
        if (result.status === 'success') {
            cache.set(cacheKey, result.data);
            res.json({
                status: true,
                message: 'Success',
                totalFetched: result.data.length,
                data: result.data
            });
        } else {
            throw new Error(result.message);
        }

    } catch (e) {
        res.status(500).json({ status: false, message: e.message });
    }
});

app.get('/enviel/drama/fetch-all', async (req, res) => {
    const cacheKey = 'drama_fetch_all';
    
    try {
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
            return res.json({
                status: true,
                message: 'Success (Cached)',
                total: cachedData.length,
                data: cachedData
            });
        }

        const result = await fetchAllDramas(20);
        
        if (result.status === 'success') {
            cache.set(cacheKey, result.data, 600);
            res.json({
                status: true,
                message: 'Success',
                total: result.data.length,
                data: result.data
            });
        } else {
            throw new Error(result.message || 'Failed to fetch');
        }

    } catch (e) {
        res.status(500).json({ status: false, message: e.message });
    }
});

app.get('/enviel/drama/fetch-all-langs', async (req, res) => {
    const cacheKey = 'drama_fetch_all_langs';
    
    try {
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
            return res.json({
                status: true,
                message: 'Success (Cached)',
                total: cachedData.total,
                stats: cachedData.stats,
                languages: SUPPORTED_LANGUAGES,
                data: cachedData.data
            });
        }

        const result = await fetchAllDramasMultiLang(20);
        
        if (result.status === 'success') {
            cache.set(cacheKey, result, 600);
            res.json({
                status: true,
                message: 'Success',
                total: result.total,
                stats: result.stats,
                languages: SUPPORTED_LANGUAGES,
                data: result.data
            });
        } else {
            throw new Error(result.message || 'Failed to fetch');
        }

    } catch (e) {
        res.status(500).json({ status: false, message: e.message });
    }
});

app.get('/enviel/drama/search', async (req, res) => {
    const q = req.query.q;
    if (!q) return res.status(400).json({ status: false, message: 'Query param "q" is required' });
    
    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 20;
    const result = await searchDrama(q, page, size);
    sendResponse(res, result);
});

app.get('/enviel/drama/suggest', async (req, res) => {
    const q = req.query.q;
    if (!q) return res.status(400).json({ status: false, message: 'Query param "q" is required' });
    
    const result = await searchSuggest(q);
    sendResponse(res, result);
});

app.get('/enviel/drama/episodes/:bookId', async (req, res) => {
    const bookId = req.params.bookId;
    const result = await scrapeEpisodes(bookId);
    
    if (result.status === 'success') {
        res.json({
            status: true,
            total: result.total,
            metadata: result.metadata,
            data: result.data
        });
    } else {
        res.status(500).json({ status: false, message: result.message });
    }
});

app.get('/enviel/drama/detail/:bookId', async (req, res) => {
    const bookId = req.params.bookId;
    const cacheKey = `detail_${bookId}`;
    
    try {
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
            return res.json({
                status: true,
                message: 'Success (Cached)',
                data: cachedData
            });
        }

        const result = await scrapeEpisodes(bookId);
        
        if (result.status === 'success') {
            const data = {
                id: bookId,
                title: result.metadata?.title || "",
                cover: result.metadata?.cover || "",
                intro: result.metadata?.intro || "",
                totalEpisodes: result.total,
                episodes: result.data
            };
            
            cache.set(cacheKey, data, 3600);
            
            res.json({
                status: true,
                message: 'Success',
                data: data
            });
        } else {
            throw new Error(result.message);
        }

    } catch(e) {
        res.status(500).json({ status: false, message: e.message });
    }
});

app.get('/', (req, res) => {
    res.json({ 
        status: true, 
        message: 'Enviel Dramabox API is Running',
        version: '1.0.0',
        endpoints: [
            'GET /enviel/drama/featured',
            'GET /enviel/drama/latest',
            'GET /enviel/drama/rank?type=1',
            'GET /enviel/drama/channel/:id',
            'GET /enviel/drama/indo',
            'GET /enviel/drama/all',
            'GET /enviel/drama/fetch-all',
            'GET /enviel/drama/fetch-all-langs',
            'GET /enviel/drama/search?q=keyword',
            'GET /enviel/drama/suggest?q=keyword',
            'GET /enviel/drama/episodes/:bookId',
            'GET /enviel/drama/detail/:bookId'
        ]
    });
});

module.exports = app;

if (require.main === module) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}
