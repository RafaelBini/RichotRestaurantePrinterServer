const fs = require('fs')
const path = require('path');

const diretorioDeLogs = './logs'

function registrarEmArquivo(currTime, theLogMessage) {
    criarDiretorioDeLogs()
    fs.appendFileSync(`${diretorioDeLogs}/logfile_${currTime.toISOString().substring(0, 10)}.txt`, theLogMessage)
}
function limparDadosAntigos() {
    try {
        criarDiretorioDeLogs()
        const duasSemanasEmMillisegundos = 2 * 7 * 24 * 60 * 60 * 1000;
        const agora = new Date().getTime();

        fs.readdirSync(diretorioDeLogs).forEach((nomeArquivo) => {
            const caminhoArquivo = path.join(diretorioDeLogs, nomeArquivo);
            const stats = fs.statSync(caminhoArquivo);
            const dataModificacao = new Date(stats.mtime).getTime();

            if (agora - dataModificacao > duasSemanasEmMillisegundos) {
                fs.unlinkSync(caminhoArquivo);
            }
        });
    }
    catch (ex) {
        console.log('Falha ao limpar logs')
    }

}
function criarDiretorioDeLogs() {
    if (!fs.existsSync(diretorioDeLogs)) {
        fs.mkdirSync(diretorioDeLogs)
    }
}

module.exports = {
    log: (message) => {
        try {
            const currTime = new Date()
            const theLogMessage = `${currTime.toLocaleString('en-CA')}: ${message}\n`
            registrarEmArquivo(currTime, theLogMessage)
        }
        catch (ex) {
            console.log('Falha ao regisrar log')
        }
    },
    limparDadosAntigos,

}