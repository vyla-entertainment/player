if (!globalThis.crypto) {
    globalThis.crypto = require('node:crypto').webcrypto;
}

require('dotenv').config();

const express = require('express');
const path = require('path');
const os = require('os');
const apiHandler = require('./api/backend.js');

const app = express();
const port = process.env.PORT || 7860;

app.use(express.static(path.join(__dirname)));
app.use('/styling', express.static(path.join(__dirname, 'styling')));
app.use('/javascript', express.static(path.join(__dirname, 'javascript')));

app.all('/api*', (req, res) => {
    apiHandler(req, res);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

function getLocalIP() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

app.listen(port, '0.0.0.0', () => {
    const ip = getLocalIP();
    console.log(`Local:   http://localhost:${port}`);
    console.log(`Network: http://${ip}:${port}`);
});