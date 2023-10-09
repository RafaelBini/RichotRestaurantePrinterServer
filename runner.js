var admin = require("firebase-admin");
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
require('dotenv-safe').config();
const { spawn } = require('child_process');
const ps = require('ps-node');
const logman = require('./logManager.js')

var db;
var status = ''

process.on('uncaughtException', (error) => {
    logman.log('Runner: EXCEÇÃO NÃO TRATADA - PROCESSO ENCERRADO: ' + error.message);
    process.exit(1);
});

function iniciarProcesso() {
    logman.log('Runner: Iniciando processo de printer server')
    const processo = spawn('node', [`${__dirname}\\richotPrinterServer.js`], {
        detached: true,
        stdio: 'ignore'
    });

    processo.unref();
}

async function verificar() {
    ps.lookup({ command: 'node' }, (err, processos) => {
        if (err) {
            logman.log('Runner: Erro ao listar os programas Node.js: ' + err.message);
            return;
        }


        if (processos.find(p => p.arguments[0].includes('richotPrinterServer.js'))) {

            if (status == 'running') return;

            db.doc(`printer_server/main`).update({
                lastCheck: FieldValue.serverTimestamp(),
                status: 'running'
            })
            status = 'running';

        }
        else {

            iniciarProcesso();

            if (status == 'stopped') return;

            status = 'stopped';

            db.doc(`printer_server/main`).update({
                lastCheck: FieldValue.serverTimestamp(),
                status: 'stopped'
            })

        }

    });
}

function startRunning() {
    // LIMPA LOGS
    logman.limparDadosAntigos()

    // INICIALIZA O FIRESTORE
    var serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    db = getFirestore();

    setInterval(() => {
        verificar()
    }, 5000)
}


startRunning()