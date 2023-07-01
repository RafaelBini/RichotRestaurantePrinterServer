var admin = require("firebase-admin");
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
require('dotenv-safe').config();
const { spawn } = require('child_process');
const ps = require('ps-node');

var db;
var status = ''

function iniciarProcesso() {
    console.log('iniciando processo')
    const processo = spawn('node', [`${__dirname}\\richotPrinterServer.js`], {
        detached: true,
        stdio: 'ignore'
    });

    processo.unref();
}

async function verificar() {
    ps.lookup({ command: 'node' }, (err, processos) => {
        if (err) {
            console.error('Erro ao listar os programas Node.js:', err);
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
    // INICIALIZA O FIRESTORE
    var serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    db = getFirestore();

    setInterval(() => {
        verificar()
    }, 15000)
}


startRunning()