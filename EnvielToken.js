const axios = require('axios');
const crypto = require('crypto');
const https = require('https');

const KONCINYA = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC9Q4Y5QX5j08Hr
nbY3irfKdkEllAU2OORnAjlXDyCzcm2Z6ZRrGvtTZUAMelfU5PWS6XGEm3d4kJEK
bXi4Crl8o2E/E3YJPk1lQD1d0JTdrvZleETN1ViHZFSQwS3L94Woh0E3TPebaEYq
88eExvKu1tDdjSoFjBbgMezySnas5Nc2xF28XhPuC8m15u+dectsrJl+ALGcTDX3
Lv3FURuwV/dN7WMEkgcseIKVMdJxzUB0PeSqCNftfxmdBV/U4yXFRxPhnSFSXCrk
j6uJjickiYq1pQ1aZfrQe1eLD3MB2hKq7crhMcA3kpggQlnmy1wRR4BAttmSU4fP
b/yF8D3hAgMBAAECggEBAJdru6p5RLZ3h/GLF2rud8bqv4piF51e/RWQyPFnMAGB
rkByiYT7bFI3cnvJMhYpLHRigqjWfUofV3thRDDym54lVLtTRZ91khRMxgwVwdRu
k8Fw7JNFenOwCJxbgdlq6iuAMuQclwll7qWUrm8DgMvzH93xf8o6X171cp4Sh0og
1Ra7E9GZ37dzBlX2aJBK8VBfctZntuDPx52e71nafqfbjXxZuEtpu92oJd6A9mWb
d0BZTk72ZHUmDcKcqjfcEH19SWOphMJFYkxU5FRoIEr3/zisyTO4Mt33ZmwELOrY
9PdlyAAyed7ZoH+hlTr7c025QROvb2LmqgRiUT56tMECgYEA+jH5m6iMRK6XjiBh
SUnlr3DzRybwlQrtIj5sZprWe2my5uYHG3jbViYIO7GtQvMTnDrBCxNhuM6dPrL0
cRnbsp/iBMXe3pyjT/aWveBkn4R+UpBsnbtDn28r1MZpCDtr5UNc0TPj4KFJvjnV
/e8oGoyYEroECqcw1LqNOGDiLhkCgYEAwaemNePYrXW+MVX/hatfLQ96tpxwf7yu
HdENZ2q5AFw73GJWYvC8VY+TcoKPAmeoCUMltI3TrS6K5Q/GoLd5K2BsoJrSxQNQ
Fd3ehWAtdOuPDvQ5rn/2fsvgvc3rOvJh7uNnwEZCI/45WQg+UFWref4PPc+ArNtp
9Xj2y7LndwkCgYARojIQeXmhYZjG6JtSugWZLuHGkwUDzChYcIPdW25gdluokG/R
zNvQn4+W/XfTryQjr7RpXm1VxCIrCBvYWNU2KrSYV4XUtL+B5ERNj6In6AOrOAif
uVITy5cQQQeoD+AT4YKKMBkQfO2gnZzqb8+ox133e+3K/mufoqJPZeyrCQKBgC2f
objwhQvYwYY+DIUharri+rYrBRYTDbJYnh/PNOaw1CmHwXJt5PEDcml3+NlIMn58
I1X2U/hpDrAIl3MlxpZBkVYFI8LmlOeR7ereTddN59ZOE4jY/OnCfqA480Jf+FKf
oMHby5lPO5OOLaAfjtae1FhrmpUe3EfIx9wVuhKBAoGBAPFzHKQZbGhkqmyPW2ct
TEIWLdUHyO37fm8dj1WjN4wjRAI4ohNiKQJRh3QE11E1PzBTl9lZVWT8QtEsSjnr
A/tpGr378fcUT7WGBgTmBRaAnv1P1n/Tp0TSvh5XpIhhMuxcitIgrhYMIG3GbP9J
NAarxO/qPW6Gi0xWaF7il7Or
-----END PRIVATE KEY-----`;

const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
const DIFAIS = [
    { m: "SM-S918B", b: "Samsung", u: "Build/TP1A.220624.014" },
    { m: "Pixel 7 Pro", b: "Google", u: "Build/TD1A.220804.009" },
    { m: "M2102K1G", b: "Xiaomi", u: "Build/SKQ1.210908.001" },
    { m: "CPH2307", b: "OPPO", u: "Build/RKQ1.211119.001" }
];

const randomHex = (len) => crypto.randomBytes(len / 2).toString('hex');
const generateUUID = () => crypto.randomUUID();
const randomNumber = (len) => {
    let res = ''; for(let i=0; i<len; i++) res += Math.floor(Math.random()*10); return res;
};

function getSignature(ts, bodyStr, devId, andId, token) {
    const payload = `timestamp=${ts}${bodyStr}${devId}${andId}${token}`;
    const signer = crypto.createSign('SHA256');
    signer.update(payload);
    signer.end();
    return signer.sign(KONCINYA, 'base64');
}

async function getNewToken() {
    const timestamp = Date.now().toString();
    const deviceId = generateUUID();
    const androidId = `00000000${randomHex(16)}00000000`;
    const instanceId = randomHex(32);
    const afid = `${timestamp}-${randomNumber(19)}`;
    const dev = DIFAIS[Math.floor(Math.random() * DIFAIS.length)];

    const bsBody = JSON.stringify({ distinctId: randomHex(16) });
    const bsSn = getSignature(timestamp, bsBody, deviceId, androidId, ""); 

    try {
        const res = await axios.post(
            'https://sapi.dramaboxdb.com/drama-box/ap001/bootstrap',
            bsBody,
            {
                params: { timestamp },
                headers: {
                    "host": "sapi.dramaboxdb.com", 
                    "package-name": "com.storymatrix.drama",
                    "version": "502", 
                    "vn": "5.0.2", 
                    "p": "52", 
                    "cid": "XDASEO1000000",
                    "apn": "2", 
                    "mcc": "510", 
                    "locale": "in_ID", 
                    "language": "in",
                    "device-id": deviceId, 
                    "android-id": androidId, 
                    "nchid": "DRA1000042",
                    "instanceid": instanceId, 
                    "tn": "", 
                    "sn": bsSn, 
                    "md": dev.m, 
                    "brand": dev.b, 
                    "build": dev.u,
                    "content-type": "application/json; charset=UTF-8", 
                    "user-agent": "okhttp/4.10.0"
                },
                httpsAgent: agent
            }
        );

        if (res.data.success) {
            return {
                status: "success",
                data: {
                    uid: res.data.data.user.uid,
                    token: `Bearer ${res.data.data.user.token}`,
                    deviceId,
                    androidId,
                    instanceId,
                    afid,
                    deviceModel: dev.m,
                    deviceBrand: dev.b,
                    deviceBuild: dev.u
                }
            };
        } else {
            return { status: "error", message: res.data.message };
        }
    } catch (e) {
        console.error("[TOKEN GEN ERROR]", e.message);
        if(e.response) {
            console.error(" - Status:", e.response.status);
            console.error(" - Data:", JSON.stringify(e.response.data));
        }
        return { status: "error", message: e.message };
    }
}

module.exports = { getNewToken, getSignature, agent };

if (require.main === module) {
    (async () => {
        console.log("Testing Token Generation...");
        const result = await getNewToken();
        console.log(JSON.stringify(result, null, 2));
    })();
}