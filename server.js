const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

// ============== MOMO SANDBOX CONFIG ==============
const MOMO_CONFIG = {
    partnerCode: 'MOMOBKUN20180529',
    accessKey: 'klm05TvNBzhg7h7j',
    secretKey: 'at67qH6mk8w5Y1nAyMoYKMWACiEi2bsa',
    endpoint: 'test-payment.momo.vn',
    redirectUrl: 'http://localhost:3000/payment-result',
    ipnUrl: 'http://localhost:3000/momo-ipn',
    requestType: 'captureWallet'
};

// Lưu trữ trạng thái thanh toán
const paymentStatus = new Map();

// ============== HELPER FUNCTIONS ==============
function generateSignature(rawSignature, secretKey) {
    return crypto.createHmac('sha256', secretKey)
        .update(rawSignature)
        .digest('hex');
}

function generateOrderId() {
    return 'ORDER' + Date.now();
}

function generateRequestId() {
    return 'REQ' + Date.now();
}

// Parse JSON body
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                resolve({});
            }
        });
        req.on('error', reject);
    });
}

// HTTPS request helper
function httpsRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ error: data });
                }
            });
        });
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
}

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

// Serve static files
function serveStatic(res, filePath) {
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
}

// Send JSON response
function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(data));
}

// ============== REQUEST HANDLERS ==============

// Create payment
async function handleCreatePayment(req, res) {
    try {
        const body = await parseBody(req);
        const { amount, orderInfo, phone, name } = body;

        const orderId = generateOrderId();
        const requestId = generateRequestId();
        const extraData = Buffer.from(JSON.stringify({ phone, name })).toString('base64');

        // Tạo raw signature
        const rawSignature = `accessKey=${MOMO_CONFIG.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${MOMO_CONFIG.ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${MOMO_CONFIG.partnerCode}&redirectUrl=${MOMO_CONFIG.redirectUrl}&requestId=${requestId}&requestType=${MOMO_CONFIG.requestType}`;

        const signature = generateSignature(rawSignature, MOMO_CONFIG.secretKey);

        const requestBody = JSON.stringify({
            partnerCode: MOMO_CONFIG.partnerCode,
            accessKey: MOMO_CONFIG.accessKey,
            requestId: requestId,
            amount: amount,
            orderId: orderId,
            orderInfo: orderInfo,
            redirectUrl: MOMO_CONFIG.redirectUrl,
            ipnUrl: MOMO_CONFIG.ipnUrl,
            extraData: extraData,
            requestType: MOMO_CONFIG.requestType,
            signature: signature,
            lang: 'vi'
        });

        console.log('Creating payment:', { orderId, amount, orderInfo });

        const options = {
            hostname: MOMO_CONFIG.endpoint,
            port: 443,
            path: '/v2/gateway/api/create',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody)
            }
        };

        const momoResponse = await httpsRequest(options, requestBody);
        console.log('Momo response:', momoResponse);

        // Lưu trạng thái pending
        paymentStatus.set(orderId, {
            status: 'pending',
            amount: amount,
            orderInfo: orderInfo,
            createdAt: new Date()
        });

        sendJson(res, 200, {
            success: momoResponse.resultCode === 0,
            orderId: orderId,
            qrCodeUrl: momoResponse.qrCodeUrl,
            payUrl: momoResponse.payUrl,
            deeplink: momoResponse.deeplink,
            message: momoResponse.message,
            resultCode: momoResponse.resultCode
        });

    } catch (error) {
        console.error('Error creating payment:', error);
        sendJson(res, 500, {
            success: false,
            message: 'Lỗi tạo thanh toán: ' + error.message
        });
    }
}

// Momo IPN callback
async function handleMomoIPN(req, res) {
    const body = await parseBody(req);
    console.log('Received IPN:', body);

    const { orderId, resultCode, message, transId, amount } = body;

    if (resultCode === 0) {
        paymentStatus.set(orderId, {
            status: 'success',
            amount: amount,
            transId: transId,
            message: message,
            completedAt: new Date()
        });
        console.log(`Payment ${orderId} SUCCESS!`);
    } else {
        paymentStatus.set(orderId, {
            status: 'failed',
            resultCode: resultCode,
            message: message,
            completedAt: new Date()
        });
        console.log(`Payment ${orderId} FAILED: ${message}`);
    }

    sendJson(res, 200, { message: 'IPN received' });
}

// Payment result redirect
function handlePaymentResult(req, res, query) {
    const { orderId, resultCode, message } = query;
    console.log('Payment result:', { orderId, resultCode, message });

    if (parseInt(resultCode) === 0) {
        res.writeHead(302, { Location: `/?orderId=${orderId}&status=success` });
    } else {
        res.writeHead(302, { Location: `/?orderId=${orderId}&status=failed&message=${encodeURIComponent(message || 'Thanh toán thất bại')}` });
    }
    res.end();
}

// Check payment status
function handlePaymentStatus(res, orderId) {
    const status = paymentStatus.get(orderId);
    sendJson(res, 200, status || { status: 'not_found' });
}

// Query payment from Momo
async function handleQueryPayment(req, res) {
    try {
        const body = await parseBody(req);
        const { orderId } = body;
        const requestId = generateRequestId();

        const rawSignature = `accessKey=${MOMO_CONFIG.accessKey}&orderId=${orderId}&partnerCode=${MOMO_CONFIG.partnerCode}&requestId=${requestId}`;
        const signature = generateSignature(rawSignature, MOMO_CONFIG.secretKey);

        const requestBody = JSON.stringify({
            partnerCode: MOMO_CONFIG.partnerCode,
            accessKey: MOMO_CONFIG.accessKey,
            requestId: requestId,
            orderId: orderId,
            signature: signature,
            lang: 'vi'
        });

        const options = {
            hostname: MOMO_CONFIG.endpoint,
            port: 443,
            path: '/v2/gateway/api/query',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody)
            }
        };

        const momoResponse = await httpsRequest(options, requestBody);
        console.log('Query result:', momoResponse);

        if (momoResponse.resultCode === 0) {
            paymentStatus.set(orderId, {
                status: 'success',
                ...momoResponse
            });
        }

        sendJson(res, 200, momoResponse);

    } catch (error) {
        console.error('Error querying payment:', error);
        sendJson(res, 500, { success: false, message: 'Lỗi kiểm tra thanh toán' });
    }
}

// ============== HTTP SERVER ==============
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;

    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    // API routes
    if (pathname === '/api/create-payment' && req.method === 'POST') {
        return handleCreatePayment(req, res);
    }

    if (pathname === '/momo-ipn' && req.method === 'POST') {
        return handleMomoIPN(req, res);
    }

    if (pathname === '/payment-result') {
        return handlePaymentResult(req, res, query);
    }

    if (pathname.startsWith('/api/payment-status/')) {
        const orderId = pathname.split('/').pop();
        return handlePaymentStatus(res, orderId);
    }

    if (pathname === '/api/query-payment' && req.method === 'POST') {
        return handleQueryPayment(req, res);
    }

    // Static files
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, filePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return serveStatic(res, filePath);
    }

    // 404
    res.writeHead(404);
    res.end('Not Found');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║       MOMO QR PAYMENT SERVER                      ║
╠═══════════════════════════════════════════════════╣
║  Server: http://localhost:${PORT}                     ║
║  Mode: Momo Sandbox                               ║
║                                                   ║
║  Endpoints:                                       ║
║  - POST /api/create-payment                       ║
║  - POST /api/query-payment                        ║
║  - GET  /api/payment-status/:orderId              ║
╚═══════════════════════════════════════════════════╝
    `);
});
