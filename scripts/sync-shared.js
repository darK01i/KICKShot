const fs = require("node:fs");
const path = require("node:path");

const raiz = path.resolve(__dirname, "..");
const origem = path.join(raiz, "shared", "media-codes.js");
const destinos = [
    path.join(raiz, "media-codes.js"),
    path.join(raiz, "Firefox", "media-codes.js")
];
const conteudo = fs.readFileSync(origem);
const somenteConferir = process.argv.includes("--check");
const divergencias = destinos.filter(destino =>
    !fs.existsSync(destino) || !fs.readFileSync(destino).equals(conteudo)
);

if (somenteConferir) {
    if (divergencias.length) {
        console.error("Os módulos compartilhados estão diferentes da fonte comum:");
        for (const destino of divergencias) console.error("- " + path.relative(raiz, destino));
        process.exitCode = 1;
    } else {
        console.log("Módulo compartilhado sincronizado no Chrome e no Firefox.");
    }
} else {
    for (const destino of destinos) fs.copyFileSync(origem, destino);
    console.log("Módulo compartilhado atualizado no Chrome e no Firefox.");
}
