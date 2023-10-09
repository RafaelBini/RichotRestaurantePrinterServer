const { SerialPort } = require('serialport');
var admin = require("firebase-admin");
require('dotenv-safe').config();
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const iconv = require('iconv-lite');
const logman = require('./logManager.js')

var printer;

process.on('uncaughtException', (error) => {
    logman.log('PrinterServer: EXCEÇÃO NÃO TRATADA - PROCESSO ENCERRADO: ' + error.message);
    process.exit(1);
});

async function getPrinter() {
    logman.log('PrinterServer: Buscando impressora')

    var serialList = await SerialPort.list();
    if (serialList.length <= 0) {
        logman.log('PrinterServer: Impressora nao encontrada')
        return false;
    }
    const serialport = new SerialPort({ path: serialList[0].path, baudRate: 9600 }, error => {
        if (error) logman.log('PrinterServer: Falha ao criar SerialPort: ' + error.message)
        return false;
    })

    serialport.on('close', () => {
        db.doc(`printer_server/main`).update({
            lastCheck: FieldValue.serverTimestamp(),
            status: 'stopped'
        })
    })

    return await new Promise(resolve => {
        const interval = setInterval(() => {
            if (serialport.isOpen) {
                logman.log('PrinterServer: impressora está aberta')
                clearInterval(interval);
                resolve(serialport);
            }
            else {
                logman.log('PrinterServer: impressora nao iniciada ainda')
            }
        }, 1000);
    })


}

function getTextFromPedido(pedido) {

    var text = `Pedido #${pedido.numPedido} - ${new Date(pedido.criadoEm.seconds * 1000).toLocaleString('pt-BR')}\n\n`

    if (pedido.retirarNoLocal) {
        text += `Será retirado por: ${pedido.cliente.nome} - tel.: ${pedido.cliente.telefone}\n\n`
    }
    else {
        text += `Entregar para:\n`
        text += `${pedido.cliente.endereco.logradouro}, ${pedido.cliente.endereco.numero} - ${pedido.cliente.endereco.complemento}\n`
        text += `${pedido.cliente.nome} - tel.: ${pedido.cliente.telefone}\n\n`
    }

    if (!pedido.marcadoPagamentoFuturo) {
        text += `Método de Pagamento: ${pedido.metodoPagamento}\n\n`
    }

    for (let produto of pedido.produtos) {
        text += `${produto.quantidade}x ${produto.titulo} | R$ ${(produto.preco * produto.quantidade).toFixed(2)}\n`
        if (produto.observacaoAutomatica) text += `- ${produto.observacaoAutomatica}\n`
        if (produto.observacaoEscrita) text += `- ${produto.observacaoEscrita}\n`
        text += `\n`
    }

    text += `\n`
    if (pedido.entrega) {
        text += `Entrega: R$ ${parseFloat(pedido.entrega).toFixed(2)}\n`
    }
    text += `Total: R$ ${parseFloat(pedido.total).toFixed(2)}\n`

    if (pedido.metodoPagamento == 'dinheiro') {
        text += `Valor em dinheiro: R$ ${parseFloat(pedido.valorEmDinheiro).toFixed(2)}\n`
        text += `Troco: R$ ${parseFloat(pedido.troco).toFixed(2)}\n`
    }


    text += `\n\n\n\n\n\n`

    text += `${String.fromCharCode(27)}${String.fromCharCode(105)}`

    return text.replace(/ã/g, 'a');

}

async function startRunning() {

    logman.log('PrinterServer: Iniciando printer server')

    // INICIALIZA O FIRESTORE
    var serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    const db = getFirestore();

    // INICIALIZA A IMPRESSORA
    printer = await getPrinter();
    if (!printer) {
        logman.log('PrinterServer: Não foi possivel conectar-se à impressora - PROCESSO ENCERRADO')
        return false;
    }



    db.collection('printer_queue').where('status', '==', 'TO_PRINT').onSnapshot(snap => {

        try {
            const docChanges = snap.docChanges();

            for (let docChange of docChanges) {

                if (docChange.type == 'removed') continue;

                const pedido = {
                    ...docChange.doc.data().pedido
                }

                logman.log('PrinterServer: imprimindo pedido ' + pedido.id)

                const buffer = iconv.encode(getTextFromPedido(pedido), 'CP437');
                printer.write(buffer, async error => {
                    if (error) {
                        logman.log(`PrinterServer: Falha ao tentar imprimir (${docChange.doc.id}): ` + error);
                        return;
                    }
                    await db.doc('printer_queue/' + docChange.doc.id).delete()
                })

            }
        }
        catch (ex) {
            logman.log('PrinterServer: Erro ao imprimir pedido na fila: ' + ex.message)
        }


    })

}

startRunning();
