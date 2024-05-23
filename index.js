const express = require('express');
const bodyParser = require('body-parser');
const imapService = require('./services/imapService');
const app = express();
const port = 3000;

app.use(bodyParser.json());

app.post('/getDocuments', async (req, res) => {
    const { email, password, host, port } = req.body;
    try {
        const documents = await imapService.getDocuments(email, password, host, port);
        res.status(200).json(documents);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota extra: /getInfoDocument/{filename}
app.get('/getInfoDocument/:filename', async (req, res) => {
    const filename = req.params.filename;
    try {
        const documentInfo = await imapService.getDocumentInfo(filename);
        res.status(200).json(documentInfo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(Microserviço rodando na porta ${port});
});