const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const raiz = path.resolve(__dirname, "..");
const arquivosJavaScript = [
    "background.js",
    "content.js",
    "media-codes.js",
    "Firefox/background.js",
    "Firefox/content.js",
    "Firefox/media-codes.js",
    "shared/media-codes.js",
    "scripts/check.js",
    "scripts/sync-shared.js",
    "tests/media-codes.test.js"
];
const manifestos = ["manifest.json", "Firefox/manifest.json"];
const erros = [];

for (const arquivo of arquivosJavaScript) {
    try {
        new vm.Script(fs.readFileSync(path.join(raiz, arquivo), "utf8"), { filename: arquivo });
    } catch (erro) {
        erros.push(`${arquivo}: ${erro.message}`);
    }
}

for (const arquivo of manifestos) {
    try {
        const manifesto = JSON.parse(fs.readFileSync(path.join(raiz, arquivo), "utf8"));
        const pasta = path.dirname(arquivo);
        const arquivosDeclarados = [
            ...(manifesto.content_scripts || []).flatMap(script => script.js || []),
            ...(manifesto.background?.service_worker ? [manifesto.background.service_worker] : []),
            ...(manifesto.background?.scripts || []),
            ...Object.values(manifesto.icons || {}),
            ...(manifesto.web_accessible_resources || []).flatMap(recurso => recurso.resources || [])
        ];
        const pastaManifesto = path.resolve(raiz, pasta);

        for (const declarado of arquivosDeclarados) {
            const caminho = path.resolve(pastaManifesto, declarado);
            const relativo = path.relative(pastaManifesto, caminho);
            if (relativo === ".." || relativo.startsWith(".." + path.sep) || path.isAbsolute(relativo)) {
                erros.push(`${arquivo}: caminho inválido: ${declarado}`);
            } else if (!fs.existsSync(caminho)) {
                erros.push(`${arquivo}: arquivo declarado não encontrado: ${declarado}`);
            }
        }

        if (!manifesto.version || !manifesto.name) {
            erros.push(`${arquivo}: faltam nome ou versão.`);
        }
    } catch (erro) {
        erros.push(`${arquivo}: ${erro.message}`);
    }
}

if (erros.length) {
    console.error("Verificação da extensão encontrou problemas:");
    for (const erro of erros) console.error("- " + erro);
    process.exitCode = 1;
} else {
    console.log("Sintaxe JavaScript e manifestos Chrome/Firefox válidos.");
}
