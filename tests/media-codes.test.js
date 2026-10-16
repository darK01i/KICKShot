const assert = require("node:assert/strict");
const { createHash, webcrypto } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const mediaCodesModules = [
    require("../media-codes.js"),
    require("../Firefox/media-codes.js")
];
const { codificarImagem, decodificarImagem, decodificarCodigoImagem, montarMensagemComMidia, separarMensagemComMidia } = mediaCodesModules[0];

test("codifica links HTTPS do Catbox em códigos curtos", () => {
    for (const mediaCodes of mediaCodesModules) {
        assert.equal(mediaCodes.codificarImagem("https://files.catbox.moe/image_123.png"), "KMC_image_123_png_IMG");
        assert.equal(mediaCodes.codificarImagem("https://files.catbox.moe/animation.gif"), "KMC_animation_gif_GIF");
    }
});

test("não codifica links fora do domínio HTTPS permitido", () => {
    assert.equal(codificarImagem("http://files.catbox.moe/image.png"), null);
    assert.equal(codificarImagem("https://example.com/image.png"), null);
});

test("usa link direto como alternativa para nomes válidos do Catbox fora do formato curto", () => {
    for (const mediaCodes of mediaCodesModules) {
        const codigo = mediaCodes.codificarImagem("https://files.catbox.moe/nome%20com%20espaço%21.png");
        assert.ok(codigo.startsWith("img:https%3A%2F%2Ffiles.catbox.moe%2F"));
        assert.match(codigo, /^img:https%3A%2F%2F[A-Za-z0-9%._~-]+$/);
        assert.deepEqual(mediaCodes.separarMensagemComMidia("legenda " + codigo), {
            antes: "legenda",
            codigo,
            depois: ""
        });
    }
});

test("os dois pacotes enviam imagem ao Catbox e retornam um endereço validado", async () => {
    for (const arquivo of ["../background.js", "../Firefox/background.js"]) {
        const listeners = [];
        let urlEnviada;
        const evento = { addListener() {} };
        const chromeApi = {
            runtime: {
                onMessage: { addListener: listener => listeners.push(listener) },
                onInstalled: evento,
                onStartup: evento
            },
            tabs: { onUpdated: evento, query: async () => [] },
            scripting: { executeScript: async () => {} }
        };

        vm.runInNewContext(fs.readFileSync(path.join(__dirname, arquivo), "utf8"), {
            chrome: chromeApi,
            URL,
            AbortController,
            Blob,
            FormData,
            atob,
            setTimeout,
            clearTimeout,
            fetch: async (url, options) => {
                urlEnviada = String(url);
                assert.equal(options.method, "POST");
                return { ok: true, status: 200, text: async () => "https://files.catbox.moe/image_123.png\n" };
            },
            console: { warn() {}, error() {} }
        });

        const listener = listeners[0];
        assert.ok(listener, `handler de upload ausente em ${arquivo}`);
        const resposta = await new Promise(resolve => {
            assert.equal(listener(
                { tipo: "KMC_UPLOAD_IMAGEM", dadosBase64: "aGVsbG8=", mime: "image/png", nome: "imagem.png" },
                { url: "https://kick.com/dark01i" },
                resolve
            ), true);
        });

        assert.equal(urlEnviada, "https://catbox.moe/user/api.php");
        assert.deepEqual(JSON.parse(JSON.stringify(resposta)), {
            sucesso: true,
            url: "https://files.catbox.moe/image_123.png"
        });
    }
});

test("os handlers de upload rejeitam páginas que não são da Kick", () => {
    for (const arquivo of ["../background.js", "../Firefox/background.js"]) {
        const listeners = [];
        const evento = { addListener() {} };
        vm.runInNewContext(fs.readFileSync(path.join(__dirname, arquivo), "utf8"), {
            chrome: {
                runtime: {
                    onMessage: { addListener: listener => listeners.push(listener) },
                    onInstalled: evento,
                    onStartup: evento
                },
                tabs: { onUpdated: evento, query: async () => [] },
                scripting: { executeScript: async () => {} }
            },
            URL,
            console: { warn() {}, error() {} }
        });

        assert.equal(listeners[0](
            { tipo: "KMC_UPLOAD_IMAGEM", dadosBase64: "aGVsbG8=", mime: "image/png", nome: "imagem.png" },
            { url: "https://example.com/" },
            () => assert.fail("não deve responder fora da Kick")
        ), false);
    }
});

test("ambos os backgrounds pesquisam na KLIPY com identificador local e validam os GIFs", async () => {
    for (const arquivo of ["../background.js", "../Firefox/background.js"]) {
        const listeners = [];
        const evento = { addListener() {} };
        const chromeApi = {
            runtime: {
                onMessage: { addListener: listener => listeners.push(listener) },
                onInstalled: evento,
                onStartup: evento
            },
            tabs: { onUpdated: evento, query: async () => [] },
            scripting: { executeScript: async () => {} },
            storage: { local: { get: (_keys, callback) => callback({}), set: (_value, callback) => callback?.() } }
        };
        let urlSolicitada;
        vm.runInNewContext(fs.readFileSync(path.join(__dirname, arquivo), "utf8"), {
            chrome: chromeApi,
            KICKSHOT_KLIPY_APP_KEY: "test-key",
            URL,
            AbortController,
            crypto: webcrypto,
            setTimeout,
            clearTimeout,
            fetch: async url => {
                urlSolicitada = new URL(url);
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        result: true,
                        data: { data: [{
                            slug: "peepoJAM-1",
                            title: "Teste",
                            file: {
                                hd: { gif: { url: "https://static.klipy.com/test.gif" } },
                                sm: { webp: { url: "https://static1.klipy.com/test.webp" } }
                            }
                        }] }
                    })
                };
            },
            console: { warn() {}, error() {} }
        });

        const listener = listeners.find((candidato, indice) => indice > 0);
        assert.ok(listener, `handler KLIPY ausente em ${arquivo}`);
        const resposta = await new Promise(resolve => {
            assert.equal(listener(
                { tipo: "KMC_BUSCAR_GIFS", consulta: "peepo", pagina: 1 },
                { url: "https://kick.com/dark01i" },
                resolve
            ), true);
        });

        assert.equal(urlSolicitada.hostname, "api.klipy.com");
        assert.match(urlSolicitada.pathname, /\/gifs\/search$/);
        assert.equal(urlSolicitada.searchParams.get("q"), "peepo");
        assert.ok(urlSolicitada.searchParams.get("customer_id"));
        assert.deepEqual(JSON.parse(JSON.stringify(resposta)), {
            sucesso: true,
            gifs: [{ url: "https://static.klipy.com/test.gif", preview: "https://static1.klipy.com/test.webp", title: "Teste", slug: "peepoJAM-1" }],
            temMais: false
        });
    }
});

test("o manifesto Firefox carrega a configuração KLIPY antes do background sem importScripts", async () => {
    const pastaFirefox = path.join(__dirname, "../Firefox");
    const manifesto = JSON.parse(fs.readFileSync(path.join(pastaFirefox, "manifest.json"), "utf8"));
    const listeners = [];
    let requisitouKlipy = false;
    const contexto = vm.createContext({
        chrome: {
            runtime: { onMessage: { addListener: listener => listeners.push(listener) } },
            storage: { local: { get: (_keys, callback) => callback({ klipyCustomerId: "test-customer" }) } }
        },
        URL,
        AbortController,
        setTimeout,
        clearTimeout,
        fetch: async url => {
            const endereco = new URL(url);
            assert.equal(endereco.hostname, "api.klipy.com");
            assert.ok(endereco.pathname === `/api/v1/${encodeURIComponent(contexto.KICKSHOT_KLIPY_APP_KEY)}/gifs/search`, "a requisição deve usar a configuração KLIPY carregada");
            requisitouKlipy = true;
            return { ok: true, json: async () => ({ result: true, data: { data: [] } }) };
        },
        console: { warn() {}, error() {} }
    });
    assert.equal(typeof contexto.importScripts, "undefined");
    for (const arquivo of manifesto.background.scripts) {
        vm.runInContext(fs.readFileSync(path.join(pastaFirefox, arquivo), "utf8"), contexto, { filename: arquivo });
    }
    assert.ok(typeof contexto.KICKSHOT_KLIPY_APP_KEY === "string" && contexto.KICKSHOT_KLIPY_APP_KEY.length > 0, "o manifesto deve carregar a configuração KLIPY");
    const resposta = await new Promise(resolve => {
        assert.equal(listeners[1](
            { tipo: "KMC_BUSCAR_GIFS", consulta: "peepo", pagina: 1 },
            { url: "https://kick.com/dark01i" },
            resolve
        ), true);
    });
    assert.equal(requisitouKlipy, true);
    assert.equal(resposta.sucesso, true);
});

test("decodifica códigos curtos para links do Catbox", () => {
    assert.equal(decodificarImagem("image_123_webm"), "https://files.catbox.moe/image_123.webm");
});

test("decodifica códigos identificados com .IMG ou .GIF e preserva o formato antigo", () => {
    for (const mediaCodes of mediaCodesModules) {
        assert.equal(mediaCodes.decodificarCodigoImagem("KMC_image_123_png_IMG"), "https://files.catbox.moe/image_123.png");
        assert.equal(mediaCodes.decodificarCodigoImagem("KMC_image_123_gif_GIF"), "https://files.catbox.moe/image_123.gif");
        assert.equal(mediaCodes.decodificarCodigoImagem("KMC_image_123_png.IMG"), "https://files.catbox.moe/image_123.png");
        assert.equal(mediaCodes.decodificarCodigoImagem("KMC_image_123_gif.GIF"), "https://files.catbox.moe/image_123.gif");
        assert.equal(mediaCodes.decodificarCodigoImagem("KMCIMG_image_123_png"), "https://files.catbox.moe/image_123.png");
    }
});

test("mantém códigos GIPHY e links diretos de GIF compatíveis nos dois navegadores", () => {
    for (const mediaCodes of mediaCodesModules) {
        const codigo = mediaCodes.codificarCodigoGiphy("abc123_Xy");
        assert.equal(codigo, "gph:abc123_Xy_GIF");
        assert.equal(mediaCodes.decodificarCodigoGiphy(codigo), "abc123_Xy");
        assert.equal(mediaCodes.decodificarCodigoGiphy("gph:abc123_Xy"), "abc123_Xy");
        assert.equal(mediaCodes.decodificarCodigoGiphy("gph:inválido"), null);
    }

    for (const arquivo of ["../content.js", "../Firefox/content.js"]) {
        const contentScript = fs.readFileSync(path.join(__dirname, arquivo), "utf8");
        assert.match(contentScript, /function criarImagemGiphy\(id\)/);
        assert.match(contentScript, /https:\/\/media\.giphy\.com\/media\//);
        assert.match(contentScript, /https:\/\/i\.giphy\.com\//);
        assert.ok(contentScript.includes("/^(?:media\\d*|i)\\.giphy\\.com$/i"));
    }
});

test("adiciona _GIF aos GIFs Tenor e mantém compatibilidade com códigos antigos", () => {
    for (const mediaCodes of mediaCodesModules) {
        const codigoNovo = mediaCodes.codificarCodigoTenor("tenor123");
        assert.equal(codigoNovo, "tnr:tenor123_GIF");
        assert.equal(mediaCodes.decodificarCodigoTenor(codigoNovo), "tenor123");
        assert.equal(mediaCodes.decodificarCodigoTenor("tnr:tenor123"), "tenor123");
        assert.equal(mediaCodes.decodificarCodigoTenor("tnr:tenor123.GIF"), "tenor123");
        assert.equal(mediaCodes.codificarCodigoTenor("id com espaço"), null);
        const mensagem = mediaCodes.montarMensagemComMidia("olha isso", codigoNovo);
        assert.ok(mensagem.startsWith("olha isso collectiblespeepoJAM "));
        assert.equal(mediaCodes.decodificarCodigoInvisivel(mensagem), codigoNovo);
        assert.equal(mediaCodes.removerCodigoInvisivel(mensagem), "olha isso");
    }
});

test("codifica, reconhece e valida códigos de GIFs KLIPY nos dois navegadores", () => {
    for (const mediaCodes of mediaCodesModules) {
        const url = "https://static.klipy.com/example.gif";
        const codigo = mediaCodes.codificarCodigoKlipy(url, "peepoJAM-123");
        assert.equal(codigo, "klp:peepoJAM-123");
        assert.equal(mediaCodes.extrairSlugCodigoKlipy(codigo), "peepoJAM-123");
        assert.equal(mediaCodes.decodificarCodigoKlipy(codigo), null);
        assert.deepEqual(mediaCodes.separarMensagemComMidia("oi " + codigo), {
            antes: "oi",
            codigo,
            depois: ""
        });
        const invisivel = mediaCodes.montarMensagemComMidia("oi", "klp:cat");
        assert.match(invisivel, /collectiblespeepoJAM/);
        assert.equal(mediaCodes.decodificarCodigoInvisivel(invisivel), "klp:cat");
        assert.equal(mediaCodes.codificarCodigoKlipy("https://example.com/example.gif", "peepoJAM"), null);
    }
});

test("normaliza os códigos Tenor com _GIF em ambos os content scripts", () => {
    for (const arquivo of ["../content.js", "../Firefox/content.js"]) {
        const contentScript = fs.readFileSync(path.join(__dirname, arquivo), "utf8");

        assert.match(contentScript, /const \{[^}]*codificarCodigoTenor, decodificarCodigoTenor[^}]*\}/);
        assert.match(contentScript, /codificarCodigoTenor\(resultado\[1\]\)/);
        assert.match(contentScript, /decodificarCodigoTenor\(texto\)/);
    }
});

test("mantém compatibilidade com códigos antigos em Base64URL", () => {
    const url = "https://files.catbox.moe/legacy-image.png";
    const codigo = Buffer.from(url).toString("base64url");

    assert.equal(decodificarImagem(codigo), url);
});

test("rejeita códigos e tipos inválidos", () => {
    assert.equal(decodificarImagem("arquivo_outraext"), null);
    assert.equal(decodificarImagem("https://example.com/image.png"), null);
    assert.equal(decodificarImagem(null), null);
});

test("carrega o módulo antes do content script nos dois navegadores", () => {
    const chromeManifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
    const firefoxManifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "Firefox", "manifest.json"), "utf8"));
    const chromeScripts = chromeManifest.content_scripts[0].js;
    const firefoxScripts = firefoxManifest.content_scripts[0].js;

    assert.deepEqual(chromeScripts, ["media-codes.js", "content.js"]);
    assert.deepEqual(firefoxScripts, ["media-codes.js", "content.js"]);
});

test("não marca o content script como iniciado antes de validar o módulo", () => {
    const contentScript = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
    const moduleCheck = contentScript.indexOf("if (!globalThis.KICKShotMediaCodes)");
    const startedFlag = contentScript.indexOf("globalThis.__KICKSHOT_CONTENT_SCRIPT_STARTED__ = true");

    assert.notEqual(moduleCheck, -1);
    assert.notEqual(startedFlag, -1);
    assert.ok(moduleCheck < startedFlag);
});

test("coloca a mensagem opcional antes do código da mídia", () => {
    const mensagem = montarMensagemComMidia("  mensagem  ", "KMCIMG_nw2hdp_png");
    assert.ok(mensagem.startsWith("mensagem collectiblespeepoJAM "));
    assert.equal(mediaCodesModules[0].decodificarCodigoInvisivel(mensagem), "KMCIMG_nw2hdp_png");
    assert.equal(mediaCodesModules[0].removerCodigoInvisivel(mensagem), "mensagem");
});

test("usa collectiblespeepoJAM como fallback para os formatos de mídia reconhecidos", () => {
    for (const mediaCodes of mediaCodesModules) {
        for (const codigo of [
            "tnr:3fPxP8_e45wAAAAM_GIF",
            "KMC_image_123_png_IMG",
            "KMCIMG_nw2hdp_png",
            "KMCGIF_TNR_tenor123_GIF",
            "img:https%3A%2F%2Ffiles.catbox.moe%2Fimage.png"
        ]) {
            const mensagem = mediaCodes.montarMensagemComMidia("", codigo);
            assert.ok(mensagem.startsWith("collectiblespeepoJAM "), codigo);
            assert.ok(!mensagem.includes(codigo), codigo);
            assert.equal(mediaCodes.decodificarCodigoInvisivel(mensagem), codigo);
            assert.equal(mediaCodes.removerCodigoInvisivel(mensagem), "");
        }

        assert.equal(mediaCodes.decodificarCodigoImagem("KMC_image_123_pngÉUMAIMAGEMCARALHO_IMG"), null);
        const mensagemComLegenda = mediaCodes.montarMensagemComMidia("olha isso", "tnr:gif123");
        assert.ok(mensagemComLegenda.startsWith("olha isso collectiblespeepoJAM "));
        assert.equal(mediaCodes.decodificarCodigoInvisivel(mensagemComLegenda), "tnr:gif123");
        assert.equal(mediaCodes.removerCodigoInvisivel(mensagemComLegenda), "olha isso");
    }
});

test("separa mensagens com códigos identificados de imagem e GIF", () => {
    assert.deepEqual(
        separarMensagemComMidia("foto KMC_nw2hdp_png_IMG"),
        { antes: "foto", codigo: "KMC_nw2hdp_png_IMG", depois: "" }
    );
    assert.deepEqual(
        separarMensagemComMidia("animação KMC_nw2hdp_gif_GIF"),
        { antes: "animação", codigo: "KMC_nw2hdp_gif_GIF", depois: "" }
    );
});

test("usa o código gerado pelo módulo em ambos os navegadores", () => {
    for (const arquivo of ["../content.js", "../Firefox/content.js"]) {
        const contentScript = fs.readFileSync(path.join(__dirname, arquivo), "utf8");

        assert.match(contentScript, /valor = codigo;/);
        assert.match(contentScript, /decodificarCodigoImagem\(encontrado\[0\]\)/);
    }
});

test("não carrega mídias bloqueadas no chat em nenhum dos navegadores", () => {
    for (const arquivo of ["../content.js", "../Firefox/content.js"]) {
        const contentScript = fs.readFileSync(path.join(__dirname, arquivo), "utf8");
        const bloqueio = contentScript.indexOf("if (midiasBloqueadasKMC.includes(chaveBloqueio))");
        const limpaFonte = contentScript.indexOf('midia.removeAttribute("src")', bloqueio);
        const carregaFonte = contentScript.indexOf("midia.src = fonteMidia", bloqueio);

        assert.notEqual(bloqueio, -1);
        assert.ok(limpaFonte > bloqueio);
        assert.ok(carregaFonte > limpaFonte);
        assert.match(contentScript, /localStorage\.getItem\("kmc_hashes_midias_bloqueadas"\)/);
        assert.match(contentScript, /hashesMidiasBloqueadasKMC\.includes\(hash\)/);
        assert.match(contentScript, /localStorage\.getItem\("kmc_mapa_hashes_midias_bloqueadas"\)/);
        assert.match(contentScript, /chavesDoHash\.has\(item\)/);
        assert.match(contentScript, /imagem\.dataset\.kmcSrc\s*=/);
        assert.match(contentScript, /video\.dataset\.kmcSrc\s*=/);
    }
});

test("carrega a mídia selecionada na prévia do painel nos dois navegadores", () => {
    for (const arquivo of ["../content.js", "../Firefox/content.js"]) {
        const contentScript = fs.readFileSync(path.join(__dirname, arquivo), "utf8");
        const inicio = contentScript.indexOf("function atualizarLinkColado()");
        const fim = contentScript.indexOf('\ndocument.getElementById("kmc-url").addEventListener', inicio);
        const corpo = contentScript.slice(inicio, fim);

        assert.notEqual(inicio, -1);
        assert.match(corpo, /media\.dataset\.kmcSrc/);
        assert.match(corpo, /media\.src = media\.dataset\.kmcSrc/);
        assert.ok(corpo.indexOf("media.src = media.dataset.kmcSrc") < corpo.indexOf("preview.replaceChildren(media)"));
    }
});

test("permite arrastar e salva a posição dos painéis principal e de GIFs nos dois navegadores", () => {
    for (const arquivo of ["../content.js", "../Firefox/content.js"]) {
        const contentScript = fs.readFileSync(path.join(__dirname, arquivo), "utf8");

        assert.match(contentScript, /tornarPainelArrastavelKMC\(painel, "principal"/);
        assert.match(contentScript, /tornarPainelArrastavelKMC\(gifPainel, "gifs"/);
        assert.match(contentScript, /cabecalho\.addEventListener\("pointerdown"/);
        assert.match(contentScript, /cabecalho\.addEventListener\("pointermove"/);
        assert.match(contentScript, /localStorage\.setItem\("kmc_posicoes_paineis"/);
        assert.match(contentScript, /posicaoSalva\s*\?\s*posicaoSalva\.left/);
        assert.match(contentScript, /posicaoSalva\s*\?\s*posicaoSalva\.top/);
    }
});

test("fecha os painéis quando a animação de saída termina nos dois navegadores", () => {
    for (const arquivo of ["../content.js", "../Firefox/content.js"]) {
        const contentScript = fs.readFileSync(path.join(__dirname, arquivo), "utf8");
        const inicio = contentScript.indexOf("function fecharPainelAnimado(");
        const fim = contentScript.indexOf("\nfunction abrirPainelAnimado(", inicio);
        const trecho = contentScript.slice(inicio, fim);
        let animacao;
        const painel = {
            style: { display: "block" },
            getAnimations: () => [],
            animate: () => (animacao = {})
        };

        assert.notEqual(inicio, -1);
        vm.runInNewContext(`${trecho}; fecharPainelAnimado(painel);`, {
            painel,
            window: { matchMedia: () => ({ matches: false }) }
        });

        assert.equal(typeof animacao.onfinish, "function");
        animacao.onfinish();
        assert.equal(painel.style.display, "none");
    }
});

test("calcula hash SHA-256 da mídia permitida nos backgrounds Chrome e Firefox", async () => {
    const conteudo = new TextEncoder().encode("conteúdo de teste da mídia");
    const hashEsperado = createHash("sha256").update(conteudo).digest("hex");

    for (const arquivo of ["../background.js", "../Firefox/background.js"]) {
        const listeners = [];
        let urlBuscada;
        const evento = { addListener: () => {} };
        const chromeApi = {
            runtime: {
                onMessage: { addListener: listener => listeners.push(listener) },
                onInstalled: evento,
                onStartup: evento
            },
            tabs: {
                onUpdated: evento,
                query: async () => [],
                get: async () => ({})
            },
            scripting: { executeScript: async () => {} }
        };

        vm.runInNewContext(fs.readFileSync(path.join(__dirname, arquivo), "utf8"), {
            chrome: chromeApi,
            URL,
            AbortController,
            setTimeout,
            clearTimeout,
            crypto: webcrypto,
            fetch: async (url, options) => {
                urlBuscada = String(url);
                assert.equal(options.credentials, "omit");
                const resposta = new Response(conteudo, {
                    status: 200,
                    headers: { "content-length": String(conteudo.byteLength) }
                });
                Object.defineProperty(resposta, "url", { value: urlBuscada });
                return resposta;
            },
            console: { warn() {} }
        });

        const listener = listeners[listeners.length - 1];
        assert.ok(listener, `handler de hash ausente em ${arquivo}`);

        const resposta = await new Promise(resolve => {
            listener(
                { tipo: "KMC_HASH_MIDIA", url: "https://files.catbox.moe/image.png" },
                { url: "https://kick.com/chat" },
                resolve
            );
        });

        assert.equal(urlBuscada, "https://files.catbox.moe/image.png");
        assert.deepEqual(JSON.parse(JSON.stringify(resposta)), { sucesso: true, hash: hashEsperado });

        let respostaHostNaoPermitido;
        assert.equal(listener(
            { tipo: "KMC_HASH_MIDIA", url: "https://example.com/image.png" },
            { url: "https://kick.com/chat" },
            resposta => { respostaHostNaoPermitido = resposta; }
        ), false);
        assert.equal(respostaHostNaoPermitido.sucesso, false);
        assert.equal(urlBuscada, "https://files.catbox.moe/image.png");
    }
});

test("preserva o envio da mídia sem texto opcional", () => {
    const imagem = montarMensagemComMidia("", "KMCIMG_nw2hdp_png");
    const gif = montarMensagemComMidia("   ", "tnr:gif123");
    assert.ok(imagem.startsWith("collectiblespeepoJAM "));
    assert.ok(gif.startsWith("collectiblespeepoJAM "));
    assert.equal(mediaCodesModules[0].decodificarCodigoInvisivel(imagem), "KMCIMG_nw2hdp_png");
    assert.equal(mediaCodesModules[0].decodificarCodigoInvisivel(gif), "tnr:gif123");
});

test("separa o texto antes e depois do código da mídia", () => {
    assert.deepEqual(
        separarMensagemComMidia("antes KMCIMG_nw2hdp_png depois"),
        { antes: "antes", codigo: "KMCIMG_nw2hdp_png", depois: "depois" }
    );
    assert.equal(separarMensagemComMidia("mensagem sem mídia"), null);
});

test("mostra o texto digitado junto da prévia de mídia nos dois navegadores", () => {
    for (const arquivo of ["../content.js", "../Firefox/content.js"]) {
        const contentScript = fs.readFileSync(path.join(__dirname, arquivo), "utf8");

        assert.match(contentScript, /id="kmc-message-preview"/);
        assert.match(contentScript, /id="kmc-image-preview-media"/);
        assert.match(contentScript, /document\.getElementById\("kmc-caption"\)\.addEventListener\("input", atualizarPreviaMensagemKMC\)/);
        assert.match(contentScript, /previewMensagem\.textContent = mensagem/);
    }
});

test("exibe a prévia do arquivo selecionado nos dois navegadores", () => {
    for (const arquivo of ["../content.js", "../Firefox/content.js"]) {
        const contentScript = fs.readFileSync(path.join(__dirname, arquivo), "utf8");
        const start = contentScript.indexOf("function mostrarPreviewImagem(file)");
        const end = contentScript.indexOf("\nasync function transformarImagemSelecionada", start);
        const functionBody = contentScript.slice(start, end);

        assert.notEqual(start, -1);
        assert.match(functionBody, /atualizarPreviaMensagemKMC\(\)/);
        assert.doesNotMatch(functionBody, /preview\.style\.display = "block"/);
    }
});

test("carrega e pesquisa GIFs pela KLIPY no painel dos dois navegadores", () => {
    for (const arquivo of ["../content.js", "../Firefox/content.js"]) {
        const contentScript = fs.readFileSync(path.join(__dirname, arquivo), "utf8");

        assert.match(contentScript, /Buscar GIFs na KLIPY/);
        assert.match(contentScript, /tipo: "KMC_BUSCAR_GIFS"/);
        assert.match(contentScript, /KMC_KLIPY_COMPARTILHADO/);
        assert.match(contentScript, /buscarGifsKMC\(true\)/);
        assert.match(contentScript, /if \(!resultadosGifsKMC\.childElementCount\) buscarGifsKMC\(\)/);
        assert.match(contentScript, /campoBuscaGifsKMC\.focus\(\);\s*buscarGifsKMC\(\);/);
    }
});

test("não mostra a frase de instrução antiga no painel de GIFs", () => {
    for (const arquivo of ["../content.js", "../Firefox/content.js"]) {
        const contentScript = fs.readFileSync(path.join(__dirname, arquivo), "utf8");
        assert.doesNotMatch(contentScript, /Pesquise GIFs e selecione um para preparar o envio/);
    }
});
