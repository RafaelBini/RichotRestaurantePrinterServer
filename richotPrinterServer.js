const { SerialPort } = require('serialport');
var admin = require("firebase-admin");
require('dotenv-safe').config();
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const iconv = require('iconv-lite');

var printer;

async function getPrinter() {

    var serialList = await SerialPort.list();
    if (serialList.length <= 0) {
        console.log('Impressora nao encontrada')
        return false;
    }
    const serialport = new SerialPort({ path: serialList[0].path, baudRate: 9600 }, error => {
        if (error) console.log('the error: ', error)
        return false;
    })

    return await new Promise(resolve => {
        const interval = setInterval(() => {
            if (serialport.isOpen) {
                console.log('impressora está aberta')
                clearInterval(interval);
                resolve(serialport);
            }
            else {
                console.log('impressora nao iniciada ainda')
            }
        }, 500);
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

    // INICIALIZA O FIRESTORE
    var serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    const db = getFirestore();

    // INICIALIZA A IMPRESSORA
    printer = await getPrinter();
    if (!printer) {
        console.log('Não foi possivel conectar-se à impressora')
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

                console.log('imprimindo pedido', pedido.id)

                const buffer = iconv.encode(getTextFromPedido(pedido), 'CP437');
                printer.write(buffer, async error => {
                    if (error) {
                        console.log(`Falha ao tentar imprimir (${docChange.doc.id}): ` + error);
                        await db.doc('printer_queue/' + docChange.doc.id).update({
                            status: 'FAILED'
                        })
                        return;
                    }
                    await db.doc('printer_queue/' + docChange.doc.id).update({
                        status: 'PRINTED'
                    })
                })

            }
        }
        catch (ex) {
            console.log('Erro', ex)
        }


    })

}

startRunning();
