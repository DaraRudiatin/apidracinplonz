const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
const { getNewToken, getSignature, agent } = require('./EnvielToken');
const API_BASE = 'https://sapi.dramaboxdb.com';
const SESSION_FILE = 'envielDracin_session.json';

let memorySession = null;

const delay = ms => new Promise(r => setTimeout(r, ms));

const SUPPORTED_LANGUAGES = ['en', 'in', 'pt', 'es'];

const buildHeaders = (sess, token, sn, length, lang = 'in') => ({
    "host": "sapi.dramaboxdb.com",
    "package-name": "com.storymatrix.drama",
    "version": "502", "vn": "5.0.2", "p": "52", "cid": "XDASEO1000000",
    "apn": "2", "country-code": "ID", "mchid": "XDASEO1000000", "mbid": "0",
    "tz": "-420", "language": lang, "mcc": "510", "locale": `${lang}_${lang.toUpperCase()}`,
    "device-id": sess.deviceId, "nchid": "DRA1000042", "instanceid": sess.instanceId,
    "md": sess.deviceModel, "store-source": "store_google", "mf": sess.deviceBrand.toUpperCase(),
    "device-score": "65", "time-zone": "+0700", "brand": sess.deviceBrand, "lat": "0",
    "current-language": lang, "ov": "13", "userid": sess.uid,
    "afid": sess.afid, "android-id": sess.androidId, "srn": "720x1612",
    "ins": "1766518441503", "build": sess.deviceBuild, "pline": "ANDROID",
    "over-flow": "new-fly", "tn": token || sess.token, "sn": sn,
    "active-time": "43277", "content-type": "application/json; charset=UTF-8",
    "content-length": length ? length.toString() : undefined,
    "accept-encoding": "gzip", "user-agent": "okhttp/4.10.0"
});

function loadSession() {
    if (memorySession) return memorySession;
    try {
        if (fs.existsSync(SESSION_FILE)) {
            memorySession = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
            return memorySession;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function saveSession(data) {
    memorySession = data;
    try {
        fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2));
    } catch (e) { /* ignore */ }
}

async function getOrInitSession() {
    let sessData = loadSession();
    if (sessData) return { status: 'success', data: sessData, source: 'cache' };
    
    const res = await getNewToken();
    if (res.status === 'success') saveSession(res.data);
    return res;
}

function processBookData(b) {
    const getVal = (v) => (typeof v === 'string' ? v : (v?.url || ''));
    return {
        bookId: b.bookId,
        title: b.bookName || b.title || "No Title",
        cover: getVal(b.cover) || getVal(b.coverWap) || "",
        intro: b.intro || b.introduction || b.abstract || "",
        chapterCount: b.chapterCount || b.episodeCount || 0,
        playCount: b.playCount || b.playNum || ""
    };
}

async function apiRequest(endpoint, body, sessionData, lang = 'in') {
    const timestamp = Date.now().toString();
    const bodyStr = JSON.stringify(body);
    const sn = getSignature(timestamp, bodyStr, sessionData.deviceId, sessionData.androidId, sessionData.token);
    
    return axios.post(`${API_BASE}${endpoint}`, bodyStr, {
        params: { timestamp },
        headers: buildHeaders(sessionData, sessionData.token, sn, Buffer.byteLength(bodyStr), lang),
        httpsAgent: agent
    });
}

async function withAutoRetry(endpoint, body, processor, lang = 'in') {
    let sess = await getOrInitSession();
    if (sess.status !== "success") return { status: "error", message: sess.message };
    let d = sess.data;

    try {
        let res = await apiRequest(endpoint, body, d, lang);

        if (!res.data.success && (res.data.status == 12 || res.data.message?.includes("Denied"))) {
            const newSess = await getNewToken();
            if (newSess.status === 'success') {
                saveSession(newSess.data);
                d = newSess.data;
                res = await apiRequest(endpoint, body, d, lang);
            } else {
                return { status: "error", message: "Session Refresh Failed" };
            }
        }

        if (res.data.success) {
            return processor(res.data.data);
        }
        return { status: "error", message: res.data.message };
    } catch (e) {
        return { status: "error", message: e.message };
    }
}

async function getDramaList(pageNo = 1, pageSize = 100) {
    return withAutoRetry('/drama-box/he001/theater', {
        homePageStyle: 0, isNeedRank: 1, isNeedNewChannel: 1, type: 1,
        pageNo, pageSize
    }, (data) => {
        const books = [];
        if (data.columnVoList) {
            data.columnVoList.forEach(col => {
                if (col.bookList) col.bookList.forEach(b => books.push(processBookData(b)));
            });
        }
        if (data.recommendList?.records) {
            data.recommendList.records.forEach(r => {
                if (r.bookId) books.push(processBookData(r));
                if (r.tagCardVo?.tagBooks) r.tagCardVo.tagBooks.forEach(b => books.push(processBookData(b)));
            });
        }
        return { status: "success", data: books };
    });
}

async function getLatestDrama(pageNo = 1, pageSize = 100) {
    return withAutoRetry('/drama-box/he001/theater', {
        newChannelStyle: 1, isNeedRank: 1, pageNo, pageSize,
        index: 1, channelId: 43
    }, (data) => {
        const list = data.newTheaterList?.records || [];
        return { status: "success", data: list.map(processBookData) };
    });
}

async function getRankDrama(rankType = 1) {
    return withAutoRetry('/drama-box/he001/rank', { rankType }, (data) => {
        const list = data.rankList || [];
        return { status: "success", data: list.map(processBookData) };
    });
}

async function getChannelDrama(channelId = 205, pageNo = 1, pageSize = 100) {
    return withAutoRetry('/drama-box/he001/theater', {
        homePageStyle: 0, isNeedRank: 1, index: 4, type: 0,
        channelId, pageNo, pageSize
    }, (data) => {
        const books = [];
        if (data.columnVoList) {
            data.columnVoList.forEach(col => {
                if (col.bookList) col.bookList.forEach(b => books.push(processBookData(b)));
            });
        }
        if (data.recommendList?.records) {
            data.recommendList.records.forEach(r => {
                if (r.bookId) books.push(processBookData(r));
            });
        }
        return { status: "success", data: books };
    });
}

async function getIndoDubbedDrama(pageNo = 1, pageSize = 100) {
    const typeList = [
        { type: 1, value: "" },
        { type: 2, value: "1" },
        { type: 3, value: "" },
        { type: 4, value: "" },
        { type: 4, value: "" },
        { type: 5, value: "1" }
    ];
    
    return withAutoRetry('/drama-box/he001/classify', {
        typeList, showLabels: false, pageNo, pageSize
    }, (data) => {
        const list = data.classifyBookList?.records || [];
        return { status: "success", data: list.map(processBookData) };
    });
}

async function getAllDramas(pageNo = 1, pageSize = 100, lang = 'in') {
    return withAutoRetry('/drama-box/he001/classify', {
        typeList: [], showLabels: false, pageNo, pageSize
    }, (data) => {
        const list = data.classifyBookList?.records || [];
        return { 
            status: "success", 
            data: list.map(processBookData), 
            total: data.classifyBookList?.total || 0 
        };
    }, lang);
}

async function fetchAllDramas(maxPages = 20, lang = 'in') {
    const allDramas = [];
    const seenIds = new Set();
    
    for (let page = 1; page <= maxPages; page++) {
        const result = await getAllDramas(page, 100, lang);
        if (result.status !== 'success' || !result.data?.length) break;
        
        let added = 0;
        for (const drama of result.data) {
            if (!seenIds.has(drama.bookId)) {
                seenIds.add(drama.bookId);
                allDramas.push({ ...drama, language: lang });
                added++;
            }
        }
        
        if (added === 0) break;
        await delay(300);
    }
    
    return { status: 'success', total: allDramas.length, data: allDramas };
}

async function fetchAllDramasMultiLang(maxPagesPerLang = 20) {
    const allDramas = [];
    const seenIds = new Set();
    const stats = {};
    
    for (const lang of SUPPORTED_LANGUAGES) {
        let langCount = 0;
        
        for (let page = 1; page <= maxPagesPerLang; page++) {
            const result = await getAllDramas(page, 100, lang);
            if (result.status !== 'success' || !result.data?.length) break;
            
            let added = 0;
            for (const drama of result.data) {
                if (!seenIds.has(drama.bookId)) {
                    seenIds.add(drama.bookId);
                    allDramas.push({ ...drama, language: lang });
                    added++;
                    langCount++;
                }
            }
            
            if (added === 0) break;
            await delay(200);
        }
        
        stats[lang] = langCount;
    }
    
    return { 
        status: 'success', 
        total: allDramas.length, 
        stats,
        data: allDramas 
    };
}

async function searchDrama(keyword, pageNo = 1, pageSize = 20) {
    return withAutoRetry('/drama-box/search/search', {
        searchSource: "搜索按钮",
        pageNo, pageSize, from: "search_sug", keyword
    }, (data) => {
        const list = data.searchList || [];
        return { status: "success", data: list.map(processBookData) };
    });
}

async function searchSuggest(keyword) {
    return withAutoRetry('/drama-box/search/suggest', { keyword }, (data) => {
        return { status: "success", data: data || [] };
    });
}

async function scrapeEpisodes(bookId, expectedTotal = 0) {
    let sess = await getOrInitSession();
    if (sess.status !== 'success') return { status: "error", message: "Initial Login Failed" };
    let d = sess.data;

    const processedIds = new Set();
    const episodeList = [];
    
    let apiIndex = -1;
    let keepRunning = true;
    let startUpKey = crypto.randomUUID();
    let metadata = {};
    let duplicateCount = 0;
    let hasRefreshedToken = false;

    while (keepRunning) {
        if (expectedTotal > 0 && episodeList.length >= expectedTotal) {
            keepRunning = false;
            break;
        }

        const reqIndex = (apiIndex < 0) ? 0 : apiIndex;
        const body = JSON.stringify({
            boundaryIndex: reqIndex, comingPlaySectionId: -1, index: reqIndex,
            currencyPlaySource: "discover_175_rec", 
            currencyPlaySourceName: "首页发现_Untukmu_推荐列表",
            preLoad: false, loadDirection: 0, startUpKey, bookId,
            pageSize: 100
        });

        const ts = Date.now().toString();
        const sn = getSignature(ts, body, d.deviceId, d.androidId, d.token);

        try {
            const res = await axios.post(
                `${API_BASE}/drama-box/chapterv2/batch/load`,
                body,
                { 
                    params: { timestamp: ts }, 
                    headers: buildHeaders(d, d.token, sn, Buffer.byteLength(body)), 
                    httpsAgent: agent 
                }
            );

            if (res.data.success) {
                const data = res.data.data;
                const chapters = data.chapterList || [];

                if (!metadata.title && (data.bookName || data.title)) {
                    metadata = {
                        title: data.bookName || data.title,
                        cover: data.bookCover || data.cover,
                        intro: data.introduction || data.intro,
                        chapterCount: data.chapterCount || 0
                    };
                }

                let added = 0;
                let maxIdx = -1;

                chapters.forEach(ch => {
                    if (ch.chapterIndex > maxIdx) maxIdx = ch.chapterIndex;
                    if (!processedIds.has(ch.chapterIndex)) {
                        processedIds.add(ch.chapterIndex);
                        
                        let url = ch.cdnList?.[0]?.videoPathList?.[0]?.videoPath || ch.videoUrl;
                        if (url) {
                            episodeList.push({ 
                                index: ch.chapterIndex, 
                                title: `Ep ${ch.chapterIndex + 1}`, 
                                url 
                            });
                            added++;
                        }
                    }
                });

                if (added > 0) {
                    duplicateCount = 0;
                    apiIndex = (maxIdx > apiIndex) ? maxIdx : apiIndex + chapters.length;
                } else {
                    if (chapters.length > 0) {
                        if (maxIdx < reqIndex && reqIndex > 0) {
                            apiIndex = reqIndex;
                        } else if (maxIdx > apiIndex) {
                            apiIndex = maxIdx;
                        } else {
                            apiIndex += chapters.length;
                        }
                    } else {
                        if (episodeList.length === 0 && !hasRefreshedToken) {
                            const newSess = await getNewToken();
                            if (newSess.status === 'success') {
                                saveSession(newSess.data);
                                d = newSess.data;
                                startUpKey = crypto.randomUUID();
                                hasRefreshedToken = true;
                                continue;
                            }
                        }
                        duplicateCount++;
                        if (duplicateCount >= 5) keepRunning = false;
                    }
                }

                await delay(500);

            } else {
                const msg = res.data.message || "";
                if (msg.includes("拒绝") || msg.includes("Denied") || res.data.status == 12) {
                    const newSess = await getNewToken();
                    if (newSess.status === 'success') {
                        saveSession(newSess.data);
                        d = newSess.data;
                        startUpKey = crypto.randomUUID();
                        await delay(100);
                    } else {
                        keepRunning = false;
                    }
                } else {
                    keepRunning = false;
                }
            }
        } catch (e) {
            if (!hasRefreshedToken && (e.response?.status === 403 || e.message.includes('403'))) {
                memorySession = null;
                if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);

                const newSess = await getNewToken();
                if (newSess.status === 'success') {
                    saveSession(newSess.data);
                    d = newSess.data;
                    startUpKey = crypto.randomUUID();
                    hasRefreshedToken = true;
                    await delay(10000);
                    continue;
                }
            }
            keepRunning = false;
        }
    }

    episodeList.sort((a, b) => a.index - b.index);
    return { status: "success", total: episodeList.length, metadata, data: episodeList };
}

module.exports = { 
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
    searchSuggest, 
    getOrInitSession 
};