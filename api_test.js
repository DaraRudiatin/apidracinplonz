const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

const endpoints = [
    { name: 'Root', method: 'GET', path: '/' },
    { name: 'Featured', method: 'GET', path: '/enviel/drama/featured' },
    { name: 'Latest', method: 'GET', path: '/enviel/drama/latest' },
    { name: 'Rank', method: 'GET', path: '/enviel/drama/rank?type=1' },
    { name: 'Channel', method: 'GET', path: '/enviel/drama/channel/205' },
    { name: 'Indo Dubbed', method: 'GET', path: '/enviel/drama/indo' },
    { name: 'All Dramas', method: 'GET', path: '/enviel/drama/all?page=1&limit=10' },
    { name: 'Search', method: 'GET', path: '/enviel/drama/search?q=love' },
    { name: 'Suggest', method: 'GET', path: '/enviel/drama/suggest?q=love' },
    { name: 'Episodes', method: 'GET', path: '/enviel/drama/episodes/42000003894' },
    { name: 'Detail', method: 'GET', path: '/enviel/drama/detail/42000003894' },
];

async function testEndpoint(endpoint) {
    const start = Date.now();
    try {
        const res = await axios({
            method: endpoint.method,
            url: `${BASE_URL}${endpoint.path}`,
            timeout: 30000
        });
        const duration = Date.now() - start;
        
        let dataCount = 0;
        if (Array.isArray(res.data.data)) {
            dataCount = res.data.data.length;
        } else if (res.data.data) {
            dataCount = 1;
        } else if (Array.isArray(res.data.endpoints)) {
            dataCount = res.data.endpoints.length;
        }

        return { 
            name: endpoint.name, 
            status: 'OK', 
            code: res.status,
            duration: `${duration}ms`,
            items: dataCount
        };
    } catch (e) {
        const duration = Date.now() - start;
        return { 
            name: endpoint.name, 
            status: 'FAIL', 
            code: e.response?.status || 'ERR',
            duration: `${duration}ms`,
            error: e.message
        };
    }
}

async function runTests() {
    console.log('ENVIEL DRAMABOX API - ENDPOINT TEST');
    console.log('─'.repeat(50));
    console.log(`Testing ${endpoints.length} endpoints on ${BASE_URL}`);
    console.log('─'.repeat(50));
    
    let passed = 0;
    let failed = 0;
    
    for (const ep of endpoints) {
        process.stdout.write(`Testing ${ep.name}... `);
        const result = await testEndpoint(ep);
        
        if (result.status === 'OK') {
            passed++;
            console.log(`\x1b[92m${result.status} [${result.code}] ${result.duration} (${result.items} items)\x1b[0m`);
        } else {
            failed++;
            console.log(`\x1b[31m${result.status} [${result.code}] ${result.duration}\x1b[0m`);
            console.log(`\x1b[31m   └─ Error: ${result.error}\x1b[0m`);
        }
    }
    
    console.log('─'.repeat(65));
    console.log(`\nResults: \x1b[92m${passed} passed\x1b[0m, \x1b[31m${failed} failed\x1b[0m out of ${endpoints.length} tests`);
    
    if (failed === 0) {
        console.log('\n\x1b[92mAll tests passed! API is working correctly.\x1b[0m');
    } else {
        console.log('\n\x1b[31mSome tests failed. Check the errors above.\x1b[0m');
    }
}

runTests();