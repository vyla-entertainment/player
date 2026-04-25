if (!globalThis.crypto) {
    globalThis.crypto = require('node:crypto').webcrypto;
}

require('dotenv').config();

const express = require('express');
const path = require('path');
const apiHandler = require('./api/index.js');

const app = express();
const port = process.env.PORT || 7860;

app.use(express.static(path.join(__dirname)));
app.use('/styling', express.static(path.join(__dirname, 'styling')));
app.use('/javascript', express.static(path.join(__dirname, 'javascript')));

app.all('/api', (req, res) => {
    apiHandler(req, res);
});

app.all('/api/proxy', (req, res) => {
    apiHandler(req, res);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
});