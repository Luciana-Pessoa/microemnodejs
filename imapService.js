const imaps = require('imap-simple');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const { MongoClient } = require('mongodb');

const getDocuments = async (email, password, host, port) => {
    const config = {
        imap: {
            user: email,
            password: password,
            host: host,
            port: port,
            tls: true,
            authTimeout: 3000
        }
    };

    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    const searchCriteria = ['UNSEEN'];
    const fetchOptions = { bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'], struct: true };
    const messages = await connection.search(searchCriteria, fetchOptions);

    let documents = [];

    for (const message of messages) {
        const parts = imaps.getParts(message.attributes.struct);
        for (const part of parts) {
            if (part.disposition && part.disposition.type.toUpperCase() === 'ATTACHMENT') {
                const partData = await connection.getPartData(message, part);
                const filename = part.disposition.params.filename;
                if (path.extname(filename) === '.xml') {
                    const contentFile = partData.toString();
                    documents.push({
                        date: new Date(),
                        filename: filename,
                        contentFile: contentFile
                    });
                    await saveDocument({
                        date: new Date(),
                        filename: filename,
                        contentFile: contentFile
                    });
                }
            }
        }
    }
    await connection.end();
    return documents;
};

const saveDocument = async (document) => {
    const uri = "your_mongodb_uri";
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect();
        const database = client.db("tcs");
        const collection = database.collection("documents");
        await collection.insertOne(document);
    } finally {
        await client.close();
    }
};

const getDocumentInfo = async (filename) => {
    const uri = "your_mongodb_uri";
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect();
        const database = client.db("tcs");
        const collection = database.collection("documents");
        const document = await collection.findOne({ filename: filename });
        
        if (!document) {
            throw new Error('Documento não encontrado');
        }

        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(document.contentFile);
        
        const info = {
            cNF: result.nfeProc.NFe[0].infNFe[0].$.Id,
            emitCNPJ: result.nfeProc.NFe[0].infNFe[0].emit[0].CNPJ[0],
            emitNome: result.nfeProc.NFe[0].infNFe[0].emit[0].xNome[0],
            destCNPJ: result.nfeProc.NFe[0].infNFe[0].dest[0].CNPJ[0],
            destNome: result.nfeProc.NFe[0].infNFe[0].dest[0].xNome[0],
            produtos: result.nfeProc.NFe[0].infNFe[0].det.map(det => ({
                xProd: det.prod[0].xProd[0],
                qCom: det.prod[0].qCom[0]
            }))
        };

        return info;
    } finally {
        await client.close();
    }
};

module.exports = { getDocuments, getDocumentInfo };