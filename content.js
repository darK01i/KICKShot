(() => {
    if (globalThis.__KICKSHOT_CONTENT_SCRIPT_STARTED__ || globalThis.__KICKSHOT_CONSENT_UI_STARTED__) return;
    if (!globalThis.KICKShotMediaCodes) {
        throw new Error("KICKShot: módulo de códigos de mídia não foi carregado.");
    }
    globalThis.__KICKSHOT_CONSENT_UI_STARTED__ = true;

    const CHAVE_CONSENTIMENTO_KMC = "kmcPrivacyConsentVersion";
    const VERSAO_CONSENTIMENTO_KMC = 2;

    function iniciarKICKShot() {
        if (globalThis.__KICKSHOT_CONTENT_SCRIPT_STARTED__) return;
        const { codificarImagem, decodificarCodigoImagem, codificarCodigoGiphy, decodificarCodigoGiphy, codificarCodigoTenor, decodificarCodigoTenor, codificarCodigoKlipy, decodificarCodigoKlipy, extrairSlugCodigoKlipy, extrairIdCodigoKlipy, montarMensagemComMidia, separarMensagemComMidia } = globalThis.KICKShotMediaCodes;
        globalThis.__KICKSHOT_CONTENT_SCRIPT_STARTED__ = true;
const SELETOR_CAMPO_EDITAVEL = 'textarea, input, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';
const codigosColadosRecentementeKMC = new Map();
let codigoColadoAguardandoEnvioKMC = false;
let campoCodigoColadoKMC = null;

function inserirTextoColadoKMC(campo, texto) {
    if (!campo) return false;
    campo.focus();

    if (campo instanceof HTMLTextAreaElement || campo instanceof HTMLInputElement) {
        const inicio = campo.selectionStart ?? campo.value.length;
        const fim = campo.selectionEnd ?? inicio;
        campo.setRangeText(texto, inicio, fim, "end");
        campo.dispatchEvent(new InputEvent("input", {
            bubbles: true,
            inputType: "insertText",
            data: texto
        }));
        return true;
    }

    // Reaproveita o cursor do editor para inserir texto simples, sem HTML/link.
    if (document.execCommand("insertText", false, texto)) return true;

    const selecao = window.getSelection();
    const intervalo = selecao && selecao.rangeCount > 0
        ? selecao.getRangeAt(0)
        : document.createRange();
    if (!campo.contains(intervalo.commonAncestorContainer)) {
        intervalo.selectNodeContents(campo);
        intervalo.collapse(false);
    }
    intervalo.deleteContents();
    const noTexto = document.createTextNode(texto);
    intervalo.insertNode(noTexto);
    intervalo.setStartAfter(noTexto);
    intervalo.collapse(true);
    selecao?.removeAllRanges();
    selecao?.addRange(intervalo);
    campo.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: texto
    }));
    return true;
}

// Protege também o instante entre colar o texto e a Kick atualizar o editor.
document.addEventListener("paste", evento => {
    const campoAlvo = evento.target instanceof Element
        ? evento.target.closest(SELETOR_CAMPO_EDITAVEL)
        : null;
    const alvo = campoAlvo && campoAlvoEhChatKMC(campoAlvo) ? campoAlvo : null;
    if (alvo) alvo.setAttribute("data-kmc-chat-input", "true");

    const textoOriginal = evento.clipboardData?.getData("text/plain") || "";
    const texto = textoOriginal;

    if (alvo && texto !== textoOriginal) {
        evento.preventDefault();
        inserirTextoColadoKMC(alvo, texto);
    }

    const codigos = texto.match(/(?:KMC_[A-Za-z0-9_.-]+[._](?:IMG|GIF)|KMCIMG_[A-Za-z0-9_.-]+|KMCGIF_TNR_[A-Za-z0-9_.-]+|gph:[A-Za-z0-9_.-]+|tnr:[A-Za-z0-9_.-]+|klp:[A-Za-z0-9_-]+)/gi) || [];
    if (alvo && codigos.length) {
        codigoColadoAguardandoEnvioKMC = true;
        campoCodigoColadoKMC = alvo;
    }

    for (const codigo of alvo ? codigos : []) {
        // Infinity significa: aguarde até o código sair do editor (envio).
        codigosColadosRecentementeKMC.set(codigo.toLowerCase(), Infinity);
    }
}, true);

// Marca o editor pelo próprio foco/entrada de texto da pessoa, sem depender
// de placeholder ou das mudanças de estrutura que a Kick faz na página.
document.addEventListener("focusin", evento => {
    const alvo = evento.target instanceof Element
        ? evento.target.closest(SELETOR_CAMPO_EDITAVEL)
        : null;
    if (alvo && campoAlvoEhChatKMC(alvo)) {
        alvo.setAttribute("data-kmc-chat-input", "true");
    }
}, true);

document.addEventListener("input", evento => {
    const elementoEvento = evento.target instanceof Element
        ? evento.target
        : null;
    const alvo = elementoEvento?.closest(SELETOR_CAMPO_EDITAVEL) || elementoEvento;
    if (
        alvo?.matches?.(SELETOR_CAMPO_EDITAVEL) &&
        alvo.hasAttribute("data-kmc-chat-input") &&
        !alvo.closest("#kmc-panel, #kmc-gif-panel")
    ) {
        const conteudo = alvo.value ?? alvo.innerText ?? alvo.textContent ?? "";
        const codigos = String(conteudo).match(/(?:KMC_[A-Za-z0-9_.-]+[._](?:IMG|GIF)|KMCIMG_[A-Za-z0-9_.-]+|KMCGIF_TNR_[A-Za-z0-9_.-]+|gph:[A-Za-z0-9_.-]+|tnr:[A-Za-z0-9_.-]+|klp:[A-Za-z0-9_-]+)/gi) || [];
        const codigosAtuais = new Set(codigos.map(codigo => codigo.toLowerCase()));
        for (const [codigo, expiraEm] of codigosColadosRecentementeKMC) {
            if (expiraEm === Infinity && !codigosAtuais.has(codigo)) {
                codigosColadosRecentementeKMC.delete(codigo);
            }
        }
        if (codigos.length) {
            codigoColadoAguardandoEnvioKMC = true;
            campoCodigoColadoKMC = alvo;
        } else if (alvo === campoCodigoColadoKMC) {
            codigoColadoAguardandoEnvioKMC = false;
            campoCodigoColadoKMC = null;
        }
        for (const codigo of codigos) {
            codigosColadosRecentementeKMC.set(codigo.toLowerCase(), Infinity);
        }
    }
}, true);

function liberarCodigosColadosKMC(campo) {
    if (!campo) return;
    const conteudo = campo.value ?? campo.innerText ?? campo.textContent ?? "";
    const codigos = String(conteudo).match(/(?:KMC_[A-Za-z0-9_.-]+[._](?:IMG|GIF)|KMCIMG_[A-Za-z0-9_.-]+|KMCGIF_TNR_[A-Za-z0-9_.-]+|gph:[A-Za-z0-9_.-]+|tnr:[A-Za-z0-9_.-]+|klp:[A-Za-z0-9_-]+)/gi) || [];
    if (!codigos.length) return;
    codigoColadoAguardandoEnvioKMC = false;
    campoCodigoColadoKMC = null;
    for (const codigo of codigos) {
        const chave = codigo.toLowerCase();
        if (codigosColadosRecentementeKMC.has(chave)) {
            // Marca como liberado pelo envio. A mensagem publicada no chat
            // será convertida assim que a Kick a inserir na página.
            codigosColadosRecentementeKMC.set(chave, 0);
        }
    }
    agendarBuscaDeMidiaDepoisDoEnvioKMC();
}

function reconciliarProtecaoDeCodigoColadoKMC() {
    if (!codigoColadoAguardandoEnvioKMC) return;

    const campo = campoCodigoColadoKMC;
    const texto = campo?.isConnected
        ? String(campo.value ?? campo.innerText ?? campo.textContent ?? "")
        : "";
    const aindaNoCampo = /(?:KMC_[A-Za-z0-9_.-]+[._](?:IMG|GIF)|KMCIMG_[A-Za-z0-9_.-]+|KMCGIF_TNR_[A-Za-z0-9_.-]+|gph:[A-Za-z0-9_.-]+|tnr:[A-Za-z0-9_.-]+|klp:[A-Za-z0-9_-]+)/i.test(texto);
    if (aindaNoCampo) return;

    codigoColadoAguardandoEnvioKMC = false;
    campoCodigoColadoKMC = null;
    for (const [codigo, expiraEm] of codigosColadosRecentementeKMC) {
        if (expiraEm === Infinity) codigosColadosRecentementeKMC.set(codigo, 0);
    }
}

function agendarBuscaDeMidiaDepoisDoEnvioKMC() {
    for (const atraso of [150, 450, 900, 1600]) {
        setTimeout(() => {
            reconciliarProtecaoDeCodigoColadoKMC();
            procurarGifsNoChat();
        }, atraso);
    }
}

function liberarProtecaoAoDetectarMensagemKMC(elemento) {
    if (!codigoColadoAguardandoEnvioKMC || !elemento) return false;
    if (
        elemento.closest?.(SELETOR_CAMPO_EDITAVEL) ||
        elemento.closest?.('[data-kmc-chat-input="true"]') ||
        elemento.closest?.("#kmc-button, #kmc-panel, #kmc-gif-panel")
    ) return false;

    const texto = elemento.textContent || "";
    const codigos = texto.match(/(?:KMC_[A-Za-z0-9_.-]+[._](?:IMG|GIF)|KMCIMG_[A-Za-z0-9_.-]+|KMCGIF_TNR_[A-Za-z0-9_.-]+|gph:[A-Za-z0-9_.-]+|tnr:[A-Za-z0-9_.-]+|klp:[A-Za-z0-9_-]+)/gi) || [];
    const codigoEnviado = codigos.find(codigo =>
        codigosColadosRecentementeKMC.has(codigo.toLowerCase())
    );
    if (!codigoEnviado) return false;

    for (const codigo of codigos) {
        if (codigosColadosRecentementeKMC.has(codigo.toLowerCase())) {
            codigosColadosRecentementeKMC.set(codigo.toLowerCase(), 0);
        }
    }
    codigoColadoAguardandoEnvioKMC = false;
    campoCodigoColadoKMC = null;
    agendarBuscaDeMidiaDepoisDoEnvioKMC();
    return true;
}

document.addEventListener("keydown", evento => {
    if (evento.key !== "Enter" || evento.shiftKey || evento.isComposing) return;
    const alvo = evento.target instanceof Element ? evento.target : null;
    const campo = alvo
        ? (alvo.closest(SELETOR_CAMPO_EDITAVEL) || (alvo === campoCodigoColadoKMC ? alvo : null))
        : null;
    liberarCodigosColadosKMC(campo);
}, true);

document.addEventListener("submit", evento => {
    const formulario = evento.target;
    const campo = formulario instanceof Element
        ? formulario.querySelector(SELETOR_CAMPO_EDITAVEL)
        : null;
    liberarCodigosColadosKMC(campo);
}, true);

document.addEventListener("click", evento => {
    const botao = evento.target instanceof Element
        ? evento.target.closest('button, [role="button"]')
        : null;
    const rotulo = botao
        ? `${botao.getAttribute("aria-label") || ""} ${botao.getAttribute("title") || ""} ${botao.textContent || ""}`.toLowerCase()
        : "";
    if (!botao || !/(send|enviar)/i.test(rotulo)) return;
    liberarCodigosColadosKMC(encontrarCampoChat());
}, true);

const botao = document.createElement("button");

botao.id = "kmc-button";
botao.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm0 16H5l4.2-5.6 2.8 3.4 2.8-3.7L19 19ZM8 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/>
    </svg>`;
botao.title = "KICKShot";
botao.setAttribute("aria-label", "Abrir o KICKShot");

Object.assign(botao.style, {
    position: "fixed",
    zIndex: "999996",
    width: "34px",
    height: "34px",
    padding: "0",
    border: "none",
    borderRadius: "0",
    background: "transparent",
    color: "#fff",
    cursor: "pointer",
    boxShadow: "none",
    display: "none",
    alignItems: "center",
    justifyContent: "center"
});

document.body.appendChild(botao);

const fontesKMC = document.createElement("link");
fontesKMC.rel = "stylesheet";
fontesKMC.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Instrument+Sans:wght@400;500;600;700&display=swap";
document.head.appendChild(fontesKMC);

const estilosKMC = document.createElement("style");
estilosKMC.textContent = `
    #kmc-panel, #kmc-gif-panel {
        transform-origin: bottom right;
        outline: 1px solid transparent;
        outline-offset: 0;
    }
    #kmc-button svg { transition: transform .18s ease; }
    #kmc-button:hover svg { transform: scale(1.12); }
    #kmc-panel, #kmc-gif-panel {
        box-sizing: border-box !important;
        font-family: Inter, system-ui, sans-serif !important;
        color: #f4f4f5 !important;
        background: #18181b !important;
        border: 1px solid #34343a !important;
        box-shadow: 0 12px 36px rgba(0,0,0,.48) !important;
        backdrop-filter: blur(10px);
    }
    #kmc-panel {
        width: min(320px, calc(100vw - 24px)) !important;
        max-height: calc(100vh - 24px);
        overflow-y: auto;
        padding: 18px !important;
    }
    #kmc-gif-panel {
        width: min(440px, calc(100vw - 24px)) !important;
        height: min(540px, calc(100vh - 24px)) !important;
        padding: 18px !important;
    }
    #kmc-gif-scroll-area {
        height: min(365px, calc(100vh - 220px)) !important;
        scrollbar-width: thin;
        scrollbar-color: #555 #222;
    }
    #kmc-gif-results {
        max-height: min(365px, calc(100vh - 250px));
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #555 #222;
    }
    #kmc-panel h3, #kmc-gif-panel h3 {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin: 0 0 16px !important;
        font-size: 17px;
        font-weight: 700;
    }
    #kmc-gif-panel #kmc-klipy-attribution {
        flex: 0 1 auto;
        margin-left: auto;
        color: #d4d4d8;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.2;
        white-space: nowrap;
    }
    #kmc-panel button, #kmc-gif-panel button {
        box-sizing: border-box;
        border: 1px solid #3b3b42 !important;
        border-radius: 8px !important;
        background: #27272a !important;
        color: #f4f4f5 !important;
        font: inherit !important;
        font-weight: 600 !important;
        transition: background .15s ease, border-color .15s ease, transform .15s ease;
    }
    #kmc-panel button:hover, #kmc-gif-panel button:hover {
        background: #35353b !important;
        border-color: #53fc18 !important;
    }
    #kmc-panel button:active, #kmc-gif-panel button:active { transform: scale(.98); }
    #kmc-panel #kmc-send {
        border-color: #53fc18 !important;
        background: #53fc18 !important;
        color: #101010 !important;
        position: sticky;
        bottom: 0;
        z-index: 5;
        margin-top: 4px;
    }
    #kmc-panel #kmc-send:hover { background: #71ff45 !important; }
    #kmc-panel input, #kmc-gif-panel input {
        box-sizing: border-box;
        min-width: 0;
        border: 1px solid #3b3b42 !important;
        border-radius: 8px !important;
        outline: none;
        background-color: #202024 !important;
        color: #fff !important;
        caret-color: #fff !important;
        -webkit-text-fill-color: #fff !important;
        color-scheme: dark;
        font: inherit !important;
    }
    #kmc-panel input::selection, #kmc-gif-panel input::selection {
        background: #53fc18;
        color: #101010;
        -webkit-text-fill-color: #101010;
    }
    #kmc-panel input:-webkit-autofill, #kmc-gif-panel input:-webkit-autofill,
    #kmc-panel input:-webkit-autofill:hover, #kmc-gif-panel input:-webkit-autofill:hover,
    #kmc-panel input:-webkit-autofill:focus, #kmc-gif-panel input:-webkit-autofill:focus {
        -webkit-box-shadow: 0 0 0 1000px #202024 inset !important;
        -webkit-text-fill-color: #fff !important;
        caret-color: #fff !important;
    }
    #kmc-panel #kmc-gif-query:focus {
        background-color: #202024 !important;
        color: #fff !important;
        -webkit-text-fill-color: #fff !important;
    }
    #kmc-panel input:focus, #kmc-gif-panel input:focus {
        border-color: #53fc18 !important;
        box-shadow: 0 0 0 2px rgba(83,252,24,.16);
    }
    #kmc-panel #kmc-drop { transition: border-color .15s ease, background .15s ease; }
    #kmc-panel #kmc-drop:hover { border-color: #53fc18 !important; background: #202a1d; color: #fff !important; }
    #kmc-panel #kmc-close, #kmc-gif-panel #kmc-gif-close {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex: 0 0 30px;
        width: 30px !important;
        height: 30px;
        padding: 0 !important;
        border-radius: 50% !important;
        font-family: Arial, sans-serif !important;
        font-size: 20px !important;
        color: #fff !important;
        text-align: center;
        line-height: 1 !important;
    }
    #kmc-panel #kmc-coffee-open {
        display: inline-flex !important;
        align-items: center !important;
        gap: 2px !important;
        width: auto !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
        color: #c4c4cc !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        line-height: 1.2 !important;
        white-space: nowrap;
        transform: translateX(5px);
        cursor: pointer;
    }
    #kmc-panel #kmc-coffee-open:hover {
        border: 0 !important;
        background: transparent !important;
        color: #fff !important;
        text-decoration: underline;
    }
    #kmc-coffee-overlay {
        position: fixed;
        inset: 0;
        z-index: 1000005;
        display: none;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        padding: 16px;
        background: rgba(0, 0, 0, .72);
        color: #f4f4f5;
        font-family: "Instrument Sans", Arial, sans-serif;
    }
    #kmc-coffee-card {
        position: relative;
        box-sizing: border-box;
        width: min(430px, calc(100vw - 32px));
        max-height: calc(100vh - 32px);
        overflow-y: auto;
        padding: 28px 20px;
        border: 1px solid #34343a;
        border-radius: 14px;
        background: #18181b;
        box-shadow: 0 16px 44px rgba(0, 0, 0, .55);
        text-align: center;
    }
    #kmc-coffee-card h2 {
        display: flex;
        align-items: center;
        gap: 7px;
        margin: 0 36px 20px 0;
        color: #fff;
        font-family: "Bricolage Grotesque", "Instrument Sans", Arial, sans-serif;
        font-size: 23px;
        font-weight: 700;
        letter-spacing: .2px;
        line-height: 1.25;
        text-align: left;
    }
    #kmc-coffee-card p {
        margin: 0 0 22px;
        color: #d4d4d8;
        font-size: 15px;
        line-height: 1.6;
        text-align: left;
    }
    #kmc-coffee-notice {
        padding: 18px 14px;
        margin-bottom: 22px;
        border: 1px solid rgba(83, 252, 24, .5);
        border-radius: 10px;
        background: rgba(83, 252, 24, .1);
        color: #d9ffd0 !important;
        font-size: 16px !important;
        font-weight: 400;
    }
    #kmc-coffee-notice strong { font-weight: 700; }
    #kmc-coffee-fundraiser { font-weight: 500; }
    #kmc-coffee-card #kmc-coffee-close {
        position: absolute;
        top: 12px;
        right: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        padding: 0;
        border: 1px solid #3b3b42;
        border-radius: 50%;
        background: #27272a;
        color: #fff;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
    }
    #kmc-coffee-qr-wrap {
        display: grid;
        justify-items: center;
        gap: 12px;
        margin: 24px auto;
        color: #d4d4d8;
        font-size: 13px;
    }
    #kmc-coffee-qr {
        display: block;
        box-sizing: border-box;
        width: 250px;
        height: 250px;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        object-fit: contain;
    }
    #kmc-coffee-link {
        display: block;
        padding: 14px 12px;
        border: 1px solid #3b3b42;
        border-radius: 8px;
        background: #27272a;
        color: #fff;
        font-size: 14px;
        font-weight: 600;
        text-decoration: none;
    }
    #kmc-coffee-link:hover { border-color: #53fc18; }
    #kmc-gif-query::-webkit-search-cancel-button,
    #kmc-gif-query::-moz-search-clear-button {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        cursor: pointer;
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 4l8 8M12 4l-8 8' stroke='%23fff' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat;
    }
    #kmc-panel #kmc-image-preview .kmc-remove {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0 !important;
        line-height: 1 !important;
        border: 1px solid rgba(255,255,255,.35) !important;
        border-radius: 50% !important;
        background: rgba(20,20,22,.88) !important;
        color: #fff !important;
        font-size: 21px !important;
        font-weight: 400 !important;
    }
    #kmc-panel #kmc-image-preview .kmc-remove:hover {
        background: #53fc18 !important;
        color: #101010 !important;
    }
    #kmc-panel .kmc-edit-toolbar {
        display: flex;
        gap: 6px;
        margin-top: 7px;
    }
    #kmc-panel .kmc-edit-toolbar button {
        flex: 1;
        padding: 6px 4px;
        font-size: 12px !important;
    }
    #kmc-panel .kmc-restore-image {
        width: 100%;
        margin-top: 6px;
        padding: 6px;
        font-size: 12px !important;
    }
    #kmc-gif-results img {
        aspect-ratio: 1 / 1;
        border: 1px solid transparent;
        transition: transform .15s ease, border-color .15s ease;
    }
    #kmc-gif-results img:hover { transform: scale(1.03); border-color: #53fc18; }
    @media (prefers-reduced-motion: reduce) {
        #kmc-panel *, #kmc-gif-panel *, #kmc-button * { transition: none !important; }
    }
`;
document.head.appendChild(estilosKMC);

const painel = document.createElement("div");

painel.id = "kmc-panel";

Object.assign(painel.style, {
    position: "fixed",
    width: "300px",
    padding: "20px",
    background: "#18181b",
    borderRadius: "12px",
    zIndex: "999998",
    color: "#fff",
    display: "none",
    boxShadow: "0 4px 20px rgba(0,0,0,0.5)"
});

painel.innerHTML = `
    <h3><span style="display:inline-flex; align-items:center; gap:14px;"><span>🎞️ KICKShot</span><button id="kmc-coffee-open" type="button" aria-haspopup="dialog" aria-controls="kmc-coffee-overlay">Pague um Café <img src="https://cdn.7tv.app/emote/60ae4121b2ecb01505492dbe/2x.webp" alt="Figurinha 7TV" width="16" height="16" loading="lazy" decoding="async" style="object-fit:contain; vertical-align:middle; transform:translate(2px, -2px);"></button></span><button id="kmc-close" type="button" aria-label="Fechar">×</button></h3>

        <button
        id="kmc-open-gifs"
        type="button"
        style="width:100%; padding:10px; margin-bottom:10px; cursor:pointer;"
    >
        🔎 Buscar GIFs
    </button>

    <button id="kmc-image"
        style="width:100%; padding:10px; margin-bottom:10px; cursor:pointer;">
        🖼️ Escolher imagem
    </button>

    <input
        id="kmc-file"
        type="file"
        accept="image/*"
        style="display:none;"
    >

    <div
        id="kmc-drop"
        style="
            box-sizing:border-box;
            width:100%;
            min-height:80px;
            margin-bottom:10px;
            padding:12px;
            border:2px dashed #555;
            border-radius:8px;
            display:flex;
            align-items:center;
            justify-content:center;
            text-align:center;
            line-height:1.4;
            color:#aaa;
            cursor:pointer;
        "
    >
        🖼️ Arraste uma imagem aqui
    </div>

    <div
        id="kmc-image-preview"
        style="
            display:none;
            margin-bottom:10px;
            text-align:center;
        "
    >
        <div
            id="kmc-message-preview"
            style="
                display:none;
                margin-bottom:6px;
                color:#fff;
                font-size:13px;
                line-height:1.4;
                text-align:left;
                white-space:pre-wrap;
                overflow-wrap:anywhere;
            "
        ></div>
        <div id="kmc-image-preview-media"></div>
    </div>

    <input
        id="kmc-url"
        placeholder="Cole um link... ou Ctrl+V uma imagem"
        title="Para colar uma imagem, deixe este campo selecionado e use Ctrl+V."
        style="box-sizing:border-box; width:100%; padding:10px; margin-bottom:10px;"
    >

    <input
        id="kmc-caption"
        type="text"
        maxlength="500"
        placeholder="Mensagem (opcional)"
        aria-label="Mensagem para enviar junto da imagem ou GIF"
        style="box-sizing:border-box; width:100%; padding:10px; margin-bottom:10px;"
    >

    <button
        id="kmc-copy-code"
        type="button"
        style="display:none; width:100%; padding:8px; margin-bottom:10px; cursor:pointer;"
    >
        📋 Copiar código
    </button>


    <button
        id="kmc-send"
        style="width:100%; padding:10px; cursor:pointer;"
    >
        📤 Enviar
    </button>
    <p style="margin:8px 0 0; color:#c4c4cc; font-size:11px; line-height:1.5; text-align:left;">
        <strong>Aviso:</strong> Não envie conteúdo ilegal ou que viole os direitos de terceiros. Você é responsável pelas imagens que compartilha. As imagens enviadas do seu dispositivo são hospedadas pelo Catbox e devem seguir as regras da plataforma.
    </p>
`;

document.body.appendChild(painel);

const modalApoioKMC = document.createElement("div");
modalApoioKMC.id = "kmc-coffee-overlay";
modalApoioKMC.setAttribute("role", "dialog");
modalApoioKMC.setAttribute("aria-modal", "true");
modalApoioKMC.setAttribute("aria-labelledby", "kmc-coffee-title");
modalApoioKMC.innerHTML = `
    <section id="kmc-coffee-card">
        <button id="kmc-coffee-close" type="button" aria-label="Fechar">×</button>
        <h2 id="kmc-coffee-title"><span>Pague um Café</span><img src="https://cdn.7tv.app/emote/60ae4121b2ecb01505492dbe/2x.webp" alt="Peepo" width="40" height="40" loading="lazy" decoding="async" style="display:block; flex:0 0 40px; object-fit:contain; transform:translate(7px, -8px);"></h2>
        <p id="kmc-coffee-notice"><strong>AVISO:</strong> Você pode usar a extensão normalmente, sem precisar fazer nenhuma doação!</p>
        <p id="kmc-coffee-fundraiser">Gostou da extensão e quer dar uma moral? Qualquer contribuição é bem-vinda, mas é totalmente opcional! Obrigado a todos que apoiam o projeto e gostam!</p>
        <div id="kmc-coffee-qr-wrap">
            <img id="kmc-coffee-qr" alt="QR Code para abrir meu LivePix oficial" width="210" height="210" loading="lazy" decoding="async">
            <span>Quer apoiar o projeto? Escaneie o QR Code! 💚</span>
        </div>
        <a id="kmc-coffee-link" href="https://livepix.gg/dark01i" target="_blank" rel="noopener noreferrer">Abrir meu LivePix</a>
        <p style="margin:10px 0 0; font-size:13px;">O QR Code direciona você ao meu LivePix oficial. Escolha o valor da contribuição e faça o pagamento via Pix.</p>
    </section>
`;
document.body.appendChild(modalApoioKMC);
document.getElementById("kmc-coffee-qr").src = chrome.runtime.getURL("icons/qr-vaquinha-livepix-gg.png");

const gifPainel = document.createElement("div");

gifPainel.id = "kmc-gif-panel";

Object.assign(gifPainel.style, {
    position: "fixed",
    width: "300px",
    padding: "15px",
    background: "#18181b",
    borderRadius: "12px",
    zIndex: "999997",
    color: "#fff",
    display: "none",
    boxShadow: "0 4px 20px rgba(0,0,0,0.5)"
});

gifPainel.innerHTML = `
    <h3><span>GIFs</span><span id="kmc-klipy-attribution">Powered by KLIPY</span><button id="kmc-gif-close" type="button" aria-label="Fechar">×</button></h3>
`;

document.body.appendChild(gifPainel);

// Se existir icons/klipy-logo.png, mostra o logo oficial no lugar do texto "Powered by KLIPY".
try {
    const atribuicaoKlipyKMC = document.getElementById("kmc-klipy-attribution");
    const logoKlipyKMC = new Image();
    logoKlipyKMC.alt = "Powered by KLIPY";
    logoKlipyKMC.style.cssText = "display:block; height:20px; width:auto; max-width:none; flex-shrink:0; object-fit:contain; image-rendering:auto; position:relative; top:-2px; left:-2px;";
    logoKlipyKMC.onload = () => { if (atribuicaoKlipyKMC) { atribuicaoKlipyKMC.style.cssText = "display:inline-flex; align-items:center; gap:6px;"; atribuicaoKlipyKMC.replaceChildren(document.createTextNode("Powered by"), logoKlipyKMC); } };
    logoKlipyKMC.src = chrome.runtime.getURL("icons/klipy-logo.png");
} catch (erro) {
    // Sem o logo, o texto continua aparecendo.
}
gifPainel.insertAdjacentHTML("beforeend", '<div style="display:flex; gap:8px; margin-bottom:10px;"><div style="position:relative; flex:1;"><input id="kmc-gif-query" type="text" maxlength="80" placeholder="Search KLIPY" aria-label="Buscar GIFs" style="width:100%; padding:10px 34px 10px 10px;"><button id="kmc-gif-clear" type="button" aria-label="Limpar busca" style="display:none; position:absolute; right:6px; top:50%; transform:translateY(-50%); width:24px; height:24px; padding:0 !important; border:0 !important; border-radius:50% !important; background:transparent !important; color:#fff !important; font-size:18px !important; line-height:1; align-items:center; justify-content:center; cursor:pointer;">×</button></div><button id="kmc-gif-search" type="button" style="padding:8px 12px; cursor:pointer;">Buscar</button></div><p id="kmc-gif-status" role="status" aria-live="polite" style="min-height:20px; margin:0 0 10px; color:#c4c4cc; font-size:13px;"></p><div id="kmc-gif-results" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(100px,1fr)); gap:8px;"></div>');

function fecharPainelAnimado(painelAlvo) {
    if (painelAlvo.style.display === "none") return;

    const animacoes = painelAlvo.getAnimations();
    animacoes.forEach(animacao => animacao.cancel());

    if (
        !painelAlvo.animate ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
        painelAlvo.style.display = "none";
        return;
    }

    const saida = painelAlvo.animate(
        [
            { opacity: 1, transform: "translateY(0) scale(1)" },
            { opacity: 0, transform: "translateY(10px) scale(.97)" }
        ],
        { duration: 240, easing: "cubic-bezier(.4,0,1,1)" }
    );
    saida.onfinish = () => {
        painelAlvo.style.display = "none";
    };
}

function abrirPainelAnimado(painelAlvo) {
    painelAlvo.getAnimations().forEach(animacao => animacao.cancel());
    painelAlvo.style.display = "block";
    painelAlvo.animate(
        [
            {
                opacity: 0,
                transform: "translateY(12px) scale(.97)"
            },
            {
                opacity: 1,
                transform: "translateY(-1px) scale(1.01)",
                offset: 0.72
            },
            {
                opacity: 1,
                transform: "translateY(0) scale(1)"
            }
        ],
        { duration: 560, easing: "cubic-bezier(.22,.61,.36,1)" }
    );
    painelAlvo.animate(
        [
            { outlineColor: "rgba(83,252,24,0)", outlineOffset: "0px" },
            { outlineColor: "rgba(83,252,24,.8)", outlineOffset: "2px", offset: 0.48 },
            { outlineColor: "rgba(83,252,24,.22)", outlineOffset: "1px" }
        ],
        { duration: 900, easing: "ease-out" }
    );

    const iconeBotao = botao.querySelector("svg");
    iconeBotao?.getAnimations().forEach(animacao => animacao.cancel());
    iconeBotao?.animate(
        [
            { transform: "rotate(-90deg) scale(.65)" },
            { transform: "rotate(24deg) scale(1.2)", offset: 0.62 },
            { transform: "rotate(0deg) scale(1)" }
        ],
        { duration: 560, easing: "cubic-bezier(.2,.8,.2,1)" }
    );
}

let imagemSelecionada = null;
let imagemOriginalSelecionada = null;
let imagemFoiEditada = false;
let previewImagemUrl = null;
let enviandoMensagem = false;
let fazendoUpload = false;
let erroUltimoUploadImagem = "";

let linksOriginais = {};

try {
    linksOriginais =
        JSON.parse(
            localStorage.getItem(
                "kmc_links_originais"
            ) || "{}"
        );
} catch (erro) {
    linksOriginais = {};
}

function salvarLinkOriginal(tag, url) {
    if (!tag || !url) {
        return;
    }

    linksOriginais[tag] = url;

    try {
        localStorage.setItem(
            "kmc_links_originais",
            JSON.stringify(linksOriginais)
        );
    } catch (erro) {
        console.warn(
            "KickMediaChat - não conseguiu salvar link:",
            erro
        );
    }
}

function obterLinkOriginal(tag) {
    return linksOriginais[tag] || null;
}


// ========================================
// POSICIONAMENTO
// ========================================

function carregarPosicoesPaineisKMC() {
    try {
        const salvas = JSON.parse(localStorage.getItem("kmc_posicoes_paineis") || "{}");
        return salvas && typeof salvas === "object" && !Array.isArray(salvas) ? salvas : {};
    } catch (erro) {
        console.warn("KickMediaChat: não foi possível carregar as posições dos painéis.", erro);
        return {};
    }
}

const posicoesPaineisKMC = carregarPosicoesPaineisKMC();

function salvarPosicoesPaineisKMC() {
    try {
        localStorage.setItem("kmc_posicoes_paineis", JSON.stringify(posicoesPaineisKMC));
    } catch (erro) {
        console.warn("KickMediaChat: não foi possível salvar as posições dos painéis.", erro);
    }
}

function limitarPosicaoPainelKMC(elemento, left, top) {
    const viewport = window.visualViewport;
    const margem = 12;
    const esquerdaVisivel = viewport?.offsetLeft || 0;
    const topoVisivel = viewport?.offsetTop || 0;
    const larguraVisivel = viewport?.width || window.innerWidth;
    const alturaVisivel = viewport?.height || window.innerHeight;
    const rect = elemento.getBoundingClientRect();
    const maxLeft = esquerdaVisivel + larguraVisivel - rect.width - margem;
    const maxTop = topoVisivel + alturaVisivel - rect.height - margem;

    return {
        left: Math.max(esquerdaVisivel + margem, Math.min(left, maxLeft)),
        top: Math.max(topoVisivel + margem, Math.min(top, maxTop))
    };
}

function tornarPainelArrastavelKMC(elemento, identificador, titulo) {
    const cabecalho = elemento.querySelector("h3");
    if (!cabecalho) return;

    cabecalho.title = titulo;
    cabecalho.style.cursor = "grab";
    cabecalho.style.touchAction = "none";
    cabecalho.style.userSelect = "none";

    cabecalho.addEventListener("pointerdown", evento => {
        if (evento.button !== 0 || evento.target.closest("button")) return;

        const rect = elemento.getBoundingClientRect();
        const inicioX = evento.clientX;
        const inicioY = evento.clientY;
        const inicioLeft = rect.left;
        const inicioTop = rect.top;
        cabecalho.style.cursor = "grabbing";
        cabecalho.setPointerCapture(evento.pointerId);

        const mover = movimento => {
            const posicao = limitarPosicaoPainelKMC(
                elemento,
                inicioLeft + movimento.clientX - inicioX,
                inicioTop + movimento.clientY - inicioY
            );
            elemento.style.left = `${posicao.left}px`;
            elemento.style.top = `${posicao.top}px`;
            posicoesPaineisKMC[identificador] = posicao;
        };

        const finalizar = () => {
            cabecalho.style.cursor = "grab";
            cabecalho.removeEventListener("pointermove", mover);
            cabecalho.removeEventListener("pointerup", finalizar);
            cabecalho.removeEventListener("pointercancel", finalizar);
            if (cabecalho.hasPointerCapture(evento.pointerId)) {
                cabecalho.releasePointerCapture(evento.pointerId);
            }
            salvarPosicoesPaineisKMC();
        };

        cabecalho.addEventListener("pointermove", mover);
        cabecalho.addEventListener("pointerup", finalizar, { once: true });
        cabecalho.addEventListener("pointercancel", finalizar, { once: true });
        evento.preventDefault();
    });
}

tornarPainelArrastavelKMC(painel, "principal", "Arraste para mover o painel");
tornarPainelArrastavelKMC(gifPainel, "gifs", "Arraste para mover o painel de GIFs");

function posicionarPainel() {
    const rect = botao.style.display === "none"
        ? null
        : botao.getBoundingClientRect();
    const viewport = window.visualViewport;
    const margem = 12;
    const esquerdaVisivel = viewport?.offsetLeft || 0;
    const topoVisivel = viewport?.offsetTop || 0;
    const larguraVisivel = viewport?.width || window.innerWidth;
    const alturaVisivel = viewport?.height || window.innerHeight;

    const limitarPosicao = (elemento, larguraBase, topoDesejado, larguraMaxima, alturaMaxima) => {
        const largura = Math.max(120, Math.min(larguraMaxima, larguraVisivel - margem * 2));
        const alturaDisponivel = Math.max(80, alturaVisivel - margem * 2);

        elemento.style.setProperty("width", `${largura}px`, "important");
        elemento.style.setProperty("max-height", `${alturaDisponivel}px`, "important");
        elemento.style.overflowY = "auto";

        if (elemento === gifPainel) {
            elemento.style.setProperty(
                "height",
                `${Math.min(alturaMaxima, alturaDisponivel)}px`,
                "important"
            );
            const areaGifs = document.getElementById("kmc-gif-scroll-area");
            if (areaGifs) {
                areaGifs.style.setProperty(
                    "height",
                    `${Math.max(80, Math.min(365, alturaDisponivel - 175))}px`,
                    "important"
                );
            }
        }

        const altura = elemento.getBoundingClientRect().height || alturaMaxima;
        const posicaoSalva = posicoesPaineisKMC[elemento === gifPainel ? "gifs" : "principal"];
        const esquerdaDesejada = posicaoSalva
            ? posicaoSalva.left
            : rect
            ? rect.left - (largura - larguraBase)
            : (parseFloat(elemento.style.left) || esquerdaVisivel + margem);
        const maxEsquerda = esquerdaVisivel + larguraVisivel - largura - margem;
        const maxTopo = topoVisivel + alturaVisivel - altura - margem;
        const esquerda = Math.max(esquerdaVisivel + margem, Math.min(esquerdaDesejada, maxEsquerda));
        const topoPreferido = posicaoSalva
            ? posicaoSalva.top
            : rect
            ? topoDesejado
            : (parseFloat(elemento.style.top) || topoVisivel + margem);
        const topo = Math.max(topoVisivel + margem, Math.min(topoPreferido, maxTopo));

        elemento.style.left = `${esquerda}px`;
        elemento.style.top = `${topo}px`;
    };

    limitarPosicao(painel, 62, rect ? rect.top - 540 : 12, 320, 420);
    limitarPosicao(gifPainel, 2, rect ? rect.top - 520 : 12, 440, 540);
}

function posicionarBotao() {

    const caminho = window.location.pathname;
    const paginaDeCanal = caminho !== "/" &&
        !caminho.startsWith("/categories") &&
        !caminho.startsWith("/search") &&
        !caminho.startsWith("/browse") &&
        !caminho.startsWith("/directory") &&
        !caminho.startsWith("/video");
    if (!paginaDeCanal) {
        botao.style.display = "none";
        return;
    }

    const engrenagens = [...document.querySelectorAll('svg[data-ds-icon="Settings"]')];
    const botoes = engrenagens
        .map(svg => svg.closest("button"))
        .filter(Boolean)
        .filter(button => {
            const rect = button.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
        });

    const campos = [...document.querySelectorAll(SELETOR_CAMPO_EDITAVEL)].filter(elemento => {
        if (elemento.closest("#kmc-panel, #kmc-gif-panel")) return false;
        const rect = elemento.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || rect.bottom <= 0 || rect.top >= window.innerHeight) return false;
        const texto = (elemento.getAttribute("placeholder") || "").toLowerCase();
        return texto.includes("message") || texto.includes("mensagem") || texto.includes("chat") ||
            elemento.isContentEditable || elemento.getAttribute("role") === "textbox";
    });

    const campoChat = campos.sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const distanciaA = Math.abs(window.innerWidth - ra.right) + Math.abs(window.innerHeight - ra.bottom);
        const distanciaB = Math.abs(window.innerWidth - rb.right) + Math.abs(window.innerHeight - rb.bottom);
        return distanciaA - distanciaB;
    })[0] || null;

    let botaoEngrenagem = null;
    if (botoes.length && campoChat) {
        const campoRect = campoChat.getBoundingClientRect();
        botaoEngrenagem = botoes.sort((a, b) => {
            const ra = a.getBoundingClientRect();
            const rb = b.getBoundingClientRect();
            const distanciaA = Math.abs(ra.left - campoRect.right) + Math.abs(ra.top - campoRect.top);
            const distanciaB = Math.abs(rb.left - campoRect.right) + Math.abs(rb.top - campoRect.top);
            return distanciaA - distanciaB;
        })[0];
    } else if (botoes.length) {
        botaoEngrenagem = botoes.sort((a, b) =>
            b.getBoundingClientRect().top - a.getBoundingClientRect().top
        )[0];
    }

    // Alguns layouts do chat da Kick não exibem o botão de configurações.
    // Nesses casos, ancora o KICKShot ao campo de mensagem visível.
    const ancora = botaoEngrenagem || campoChat;
    if (!ancora) {
        botao.style.display = "none";
        return;
    }

    const rect = ancora.getBoundingClientRect();
    const esquerda = Math.max(12, Math.min(rect.left - 42, window.innerWidth - 46));
    const topo = Math.max(12, Math.min(rect.top + rect.height / 2 - 17, window.innerHeight - 46));
    botao.style.left = esquerda + "px";
    botao.style.top = topo + "px";
    botao.style.right = "auto";
    botao.style.display = "flex";

    if (
        painel.style.display === "none" &&
        gifPainel.style.display === "none"
    ) {
        posicionarPainel();
    }
}

let quadroPosicionamentoBotaoKMC = 0;
function agendarPosicionamentoBotaoKMC() {
    if (quadroPosicionamentoBotaoKMC) return;
    quadroPosicionamentoBotaoKMC = requestAnimationFrame(() => {
        quadroPosicionamentoBotaoKMC = 0;
        posicionarBotao();
    });
}


// ========================================
// PÁGINA
// ========================================

function verificarPagina() {

    const caminho =
        window.location.pathname;

    const paginaDeCanal =
        caminho !== "/" &&
        !caminho.startsWith("/categories") &&
        !caminho.startsWith("/search") &&
        !caminho.startsWith("/browse") &&
        !caminho.startsWith("/directory") &&
        !caminho.startsWith("/video");

    if (!paginaDeCanal) {

        botao.style.display = "none";
        painel.style.display = "none";
        gifPainel.style.display = "none";
        modalApoioKMC.style.display = "none";

        return;
    }

    posicionarBotao();
}


// ========================================
// BOTÃO
// ========================================

botao.addEventListener(
    "click",
    evento => {

        evento.stopPropagation();

        // Mensagens de runtime acordam o service worker MV3 quando ele está inativo.
        try {
            const runtime = globalThis.chrome && globalThis.chrome.runtime;
            if (runtime && typeof runtime.sendMessage === "function") {
                runtime.sendMessage({ tipo: "KMC_ACORDAR_SERVICE_WORKER" }, () => {
                    void runtime.lastError;
                });
            }
        } catch (erro) {
            // Um contexto invalidado só pode ser recuperado ao atualizar a página.
        }

        if (
            painel.style.display === "none"
        ) {

            gifPainel.style.display =
                "none";

            abrirPainelAnimado(painel);

            posicionarPainel();

        } else {

            fecharPainelAnimado(painel);
            fecharPainelAnimado(gifPainel);
        }
    }
);

painel.addEventListener(
    "click",
    evento => {
        evento.stopPropagation();
    }
);

painel.addEventListener("paste", evento => {
    const areaTransferencia = evento.clipboardData;
    if (!areaTransferencia) return;

    const itemImagem = Array.from(areaTransferencia.items || []).find(
        item => item.kind === "file" && item.type.startsWith("image/")
    );
    const arquivoImagem =
        itemImagem?.getAsFile() ||
        Array.from(areaTransferencia.files || []).find(
            arquivo => arquivo.type.startsWith("image/")
        );

    if (!arquivoImagem) return;

    evento.preventDefault();
    evento.stopPropagation();
    selecionarImagem(arquivoImagem);
}, true);

document.getElementById("kmc-close").addEventListener("click", evento => {
    evento.stopPropagation();
    fecharPainelAnimado(painel);
});

const botaoApoioKMC = document.getElementById("kmc-coffee-open");
const fecharApoioKMC = () => {
    modalApoioKMC.style.display = "none";
    botaoApoioKMC.focus();
};

botaoApoioKMC.addEventListener("click", evento => {
    evento.stopPropagation();
    modalApoioKMC.style.display = "flex";
    document.getElementById("kmc-coffee-close").focus();
});

document.getElementById("kmc-coffee-close").addEventListener("click", evento => {
    evento.stopPropagation();
    fecharApoioKMC();
});

modalApoioKMC.addEventListener("click", evento => {
    if (evento.target === modalApoioKMC) fecharApoioKMC();
});

document.addEventListener("keydown", evento => {
    if (evento.key === "Escape" && modalApoioKMC.style.display === "flex") {
        fecharApoioKMC();
    }
});

gifPainel.addEventListener(
    "click",
    evento => {
        evento.stopPropagation();
    }
);

document.getElementById("kmc-gif-close").addEventListener("click", evento => {
    evento.stopPropagation();
    fecharPainelAnimado(gifPainel);
});

let gifKlipySelecionado = null;
const campoBuscaGifsKMC = document.getElementById("kmc-gif-query");
const resultadosGifsKMC = document.getElementById("kmc-gif-results");
const statusBuscaGifsKMC = document.getElementById("kmc-gif-status");
const botaoBuscarGifsKMC = document.getElementById("kmc-gif-search");
const botaoLimparBuscaGifsKMC = document.getElementById("kmc-gif-clear");
campoBuscaGifsKMC.addEventListener("input", () => {
    botaoLimparBuscaGifsKMC.style.display = campoBuscaGifsKMC.value ? "flex" : "none";
});
botaoLimparBuscaGifsKMC.addEventListener("click", evento => {
    evento.stopPropagation();
    campoBuscaGifsKMC.value = "";
    campoBuscaGifsKMC.dispatchEvent(new Event("input", { bubbles: true }));
    campoBuscaGifsKMC.focus();
    buscarGifsKMC();
});

function solicitarGifsKMC(consulta, pagina = 1) {
    const runtime = globalThis.chrome && globalThis.chrome.runtime;
    if (!runtime || typeof runtime.sendMessage !== "function") {
        return Promise.reject(new Error("Recarregue a extensão e a página da Kick."));
    }

    return new Promise((resolve, reject) => {
        try {
            runtime.sendMessage({ tipo: "KMC_BUSCAR_GIFS", consulta, pagina }, resposta => {
                const erro = runtime.lastError;
                if (erro) {
                    const detalhe = erro.message || "";
                    const contextoInvalidado = /extension context invalidated|context invalidated/i.test(detalhe);
                    return reject(new Error(contextoInvalidado
                        ? "A extensão foi recarregada. Atualize a página do Kick e tente buscar novamente."
                        : "A busca não conseguiu acordar o serviço da extensão. Tente novamente; se persistir, atualize a página do Kick."));
                }
                if (!resposta || !resposta.sucesso) {
                    return reject(new Error(resposta && resposta.erro || "Não foi possível buscar GIFs."));
                }
                resolve({ gifs: Array.isArray(resposta.gifs) ? resposta.gifs : [], temMais: resposta.temMais === true });
            });
        } catch (erro) {
            const detalhe = erro && erro.message ? erro.message : String(erro);
            const contextoInvalidado = /extension context invalidated|context invalidated/i.test(detalhe);
            reject(new Error(contextoInvalidado
                ? "A extensão foi recarregada. Atualize a página do Kick e tente buscar novamente."
                : "A busca não conseguiu acordar o serviço da extensão. Tente novamente; se persistir, atualize a página do Kick."));
        }
    });
}

const resolucoesKlipyKMC = new Map();

function solicitarUrlKlipyPorSlugKMC(slug, tipo = "slug") {
    const chave = tipo + ":" + slug;
    if (resolucoesKlipyKMC.has(chave)) return resolucoesKlipyKMC.get(chave);
    const runtime = globalThis.chrome && globalThis.chrome.runtime;
    if (!runtime || typeof runtime.sendMessage !== "function") {
        return Promise.reject(new Error("Recarregue a extensão e a página da Kick."));
    }

    const pedido = new Promise((resolve, reject) => {
        try {
            runtime.sendMessage({ tipo: "KMC_KLIPY_RESOLVER", [tipo]: slug }, resposta => {
                const erro = runtime.lastError;
                if (erro) {
                    const detalhe = erro.message || "";
                    const contextoInvalidado = /extension context invalidated|context invalidated/i.test(detalhe);
                    return reject(new Error(contextoInvalidado
                        ? "A extensão foi recarregada. Atualize a página do Kick para continuar."
                        : "Não foi possível acordar o serviço da extensão para recuperar este GIF. Tente novamente."));
                }
                if (!resposta?.sucesso || !codificarCodigoKlipy(resposta.url)) {
                    return reject(new Error(resposta?.erro || "Não foi possível recuperar este GIF da KLIPY."));
                }
                resolve(resposta.url);
            });
        } catch (erro) {
            const detalhe = erro && erro.message ? erro.message : String(erro);
            const contextoInvalidado = /extension context invalidated|context invalidated/i.test(detalhe);
            reject(new Error(contextoInvalidado
                ? "A extensão foi recarregada. Atualize a página do Kick para continuar."
                : "Não foi possível acordar o serviço da extensão para recuperar este GIF. Tente novamente."));
        }
    }).catch(erro => {
        resolucoesKlipyKMC.delete(chave);
        throw erro;
    });

    resolucoesKlipyKMC.set(chave, pedido);
    if (resolucoesKlipyKMC.size > 100) {
        resolucoesKlipyKMC.delete(resolucoesKlipyKMC.keys().next().value);
    }
    return pedido;
}

function resolverCodigoKlipyKMC(elemento, codigo, slug, legenda = { antes: "", depois: "" }, tipo = "slug") {
    if (!elemento || elemento.dataset.kmcResolving === "true") return;
    elemento.dataset.kmcResolving = "true";
    solicitarUrlKlipyPorSlugKMC(slug, tipo).then(url => {
        if (!elemento.isConnected || elemento.dataset.kmcProcessed === "true" || !elemento.textContent.includes(codigo)) return;
        const imagem = criarImagemKlipy(url);
        renderizarCodigoComMidia(elemento, codigo, url, imagem, true, legenda);
    }).catch(() => {
        // Mantém o código curto visível se a API estiver indisponível.
    }).finally(() => {
        if (elemento.dataset.kmcProcessed !== "true") delete elemento.dataset.kmcResolving;
    });
}

let paginaGifsKMC = 0;
let temMaisGifsKMC = false;
let carregandoGifsKMC = false;
let consultaGifsAtualKMC = "";

async function buscarGifsKMC(proximaPagina = false) {
    if (carregandoGifsKMC) return;
    const consulta = campoBuscaGifsKMC.value.trim();
    if (!proximaPagina) {
        resultadosGifsKMC.replaceChildren();
        paginaGifsKMC = 0;
        temMaisGifsKMC = false;
        consultaGifsAtualKMC = consulta;
    } else if (!temMaisGifsKMC || consulta !== consultaGifsAtualKMC) {
        return;
    }

    carregandoGifsKMC = true;
    botaoBuscarGifsKMC.disabled = true;
    statusBuscaGifsKMC.textContent = paginaGifsKMC === 0
        ? (consulta ? "Buscando GIFs…" : "Carregando GIFs populares…")
        : "Carregando mais GIFs…";
    try {
        const pagina = paginaGifsKMC + 1;
        const resposta = await solicitarGifsKMC(consulta, pagina);
        const gifs = resposta.gifs;
        if (!gifs.length) {
            temMaisGifsKMC = false;
            statusBuscaGifsKMC.textContent = paginaGifsKMC === 0 ? "Nenhum GIF encontrado." : "Clique em um GIF para preparar o envio.";
            return;
        }

        paginaGifsKMC = pagina;
        temMaisGifsKMC = resposta.temMais;
        statusBuscaGifsKMC.textContent = "Clique em um GIF para preparar o envio.";
        for (const gif of gifs) {
            if (!gif || typeof gif.url !== "string" || !codificarCodigoKlipy(gif.url, gif.slug, gif.id)) continue;
            const escolha = document.createElement("button");
            escolha.type = "button";
            escolha.title = gif.title || "Selecionar GIF";
            escolha.setAttribute("aria-label", gif.title || "Selecionar GIF");
            escolha.style.cssText = "padding:4px; cursor:pointer; min-height:100px;";

            const imagem = document.createElement("img");
            imagem.src = gif.preview || gif.url;
            imagem.alt = gif.title || "GIF da KLIPY";
            imagem.loading = "lazy";
            imagem.style.cssText = "display:block; width:100%; height:100px; object-fit:cover; border-radius:5px;";
            escolha.appendChild(imagem);
            escolha.addEventListener("click", evento => {
                evento.stopPropagation();
                const campoUrl = document.getElementById("kmc-url");
                campoUrl.value = gif.url;
                gifKlipySelecionado = { slug: gif.slug, id: gif.id, consulta: campoBuscaGifsKMC.value.trim(), url: gif.url };
                resolucoesKlipyKMC.set("slug:" + gif.slug, Promise.resolve(gif.url));
                if (gif.id) resolucoesKlipyKMC.set("id:" + gif.id, Promise.resolve(gif.url));
                campoUrl.dispatchEvent(new Event("input", { bubbles: true }));
                fecharPainelAnimado(gifPainel);
                abrirPainelAnimado(painel);
                posicionarPainel();
            });
            resultadosGifsKMC.appendChild(escolha);
        }
    } catch (erro) {
        statusBuscaGifsKMC.textContent = erro.message || "Erro ao buscar GIFs.";
    } finally {
        carregandoGifsKMC = false;
        botaoBuscarGifsKMC.disabled = false;
    }
}

resultadosGifsKMC.addEventListener("scroll", () => {
    if (resultadosGifsKMC.scrollTop + resultadosGifsKMC.clientHeight >= resultadosGifsKMC.scrollHeight - 80) {
        buscarGifsKMC(true);
    }
});

document.getElementById("kmc-open-gifs").addEventListener("click", evento => {
    evento.stopPropagation();
    fecharPainelAnimado(painel);
    abrirPainelAnimado(gifPainel);
    posicionarPainel();
    if (!resultadosGifsKMC.childElementCount) buscarGifsKMC();
    campoBuscaGifsKMC.focus();
});

botaoBuscarGifsKMC.addEventListener("click", evento => {
    evento.stopPropagation();
    buscarGifsKMC();
});

campoBuscaGifsKMC.addEventListener("keydown", evento => {
    if (evento.key === "Enter") {
        evento.preventDefault();
        buscarGifsKMC();
    }
});

document.addEventListener(
    "click",
    () => {

        if (enviandoMensagem) {
            return;
        }

        fecharPainelAnimado(painel);
        fecharPainelAnimado(gifPainel);
    }
);


// ========================================
// CONVERSÃO DE LINKS
// ========================================

function converterEnderecoParaTag(valor) {

    if (!valor) {
        return null;
    }

    valor =
        valor.trim();

    if (
        /^gph:[A-Za-z0-9_.-]+$/i.test(valor)
    ) {
        return valor;
    }

    if (/^klp:/i.test(valor)) {
        return decodificarCodigoKlipy(valor) || extrairSlugCodigoKlipy(valor) ? valor : null;
    }

    if (
        /^tnr:[A-Za-z0-9_.-]+$/i.test(valor)
    ) {
        const id = decodificarCodigoTenor(valor);
        return id ? codificarCodigoTenor(id) : null;
    }

    const gifKlipy = gifKlipySelecionado?.url === valor ? gifKlipySelecionado : null;
    const codigoKlipy = codificarCodigoKlipy(valor, gifKlipy?.slug, gifKlipy?.id);
    if (codigoKlipy) return codigoKlipy;

    if (
        /^KMCGIF_TNR_[A-Za-z0-9_.-]+$/i.test(valor)
    ) {
        const id = valor.replace(/^KMCGIF_TNR_/i, "").replace(/[._]GIF$/i, "");
        const codigo = codificarCodigoTenor(id);
        return codigo || valor;
    }

    if (
        /^(?:KMC_[A-Za-z0-9_.-]+[._](?:IMG|GIF)|KMCIMG_[A-Za-z0-9_.-]+)$/i.test(valor)
    ) {
        return valor;
    }

    if (
        /^img:https%3A/i.test(valor)
    ) {
        return valor;
    }

    let resultado =
        valor.match(
            /giphy\.com\/media\/([A-Za-z0-9_-]+)(?:[/?#]|$)/i
        );

    if (resultado) {

        const id =
            resultado[1];

        const tag =
            codificarCodigoGiphy(id);

        salvarLinkOriginal(
            tag,
            valor
        );

        return tag;
    }

    resultado =
        valor.match(
            /giphy\.com\/gifs\/[^/?#]+-([A-Za-z0-9_-]+)(?:[/?#]|$)/i
        );

    if (resultado) {

        const id =
            resultado[1];

        const tag =
            codificarCodigoGiphy(id);

        salvarLinkOriginal(
            tag,
            valor
        );

        return tag;
    }

    resultado =
        valor.match(
            /(?:https?:\/\/)?(?:media|i)\.giphy\.com\/(?:media\/)?([A-Za-z0-9_-]+)(?:\/|$)/i
        );

    if (resultado) {

        const id =
            resultado[1];

        const tag =
            codificarCodigoGiphy(id);

        salvarLinkOriginal(
            tag,
            valor
        );

        return tag;
    }

    resultado =
        valor.match(
            /giphy\.com\/media\/v1\.[^/?#]+\/([A-Za-z0-9_-]+)(?:\/|$)/i
        );

    if (resultado) {

        const id =
            resultado[1];

        const tag =
            codificarCodigoGiphy(id);

        salvarLinkOriginal(
            tag,
            valor
        );

        return tag;
    }

    resultado =
        valor.match(
            /(?:https?:\/\/)?media\.tenor\.com\/([A-Za-z0-9_-]+)(?:\/|$)/i
        );

    if (resultado) {

        const id =
            resultado[1];

        const tag =
            codificarCodigoTenor(id);

        salvarLinkOriginal(
            tag,
            valor
        );

        return tag;
    }

    resultado =
        valor.match(
            /(?:https?:\/\/)?media1\.tenor\.com\/m\/([A-Za-z0-9_-]+)(?:\/|$)/i
        );

    if (resultado) {

        const id =
            resultado[1];

        const tag =
            codificarCodigoTenor(id);

        salvarLinkOriginal(
            tag,
            valor
        );

        return tag;
    }

    resultado =
        valor.match(
            /(?:https?:\/\/)?media1\.tenor\.com\/([A-Za-z0-9_-]+)(?:\/|$)/i
        );

    if (resultado) {

        const id =
            resultado[1];

        const tag =
            codificarCodigoTenor(id);

        salvarLinkOriginal(
            tag,
            valor
        );

        return tag;
    }

    resultado =
        valor.match(
            /tenor\.com\/view\/[^/?#]+-([A-Za-z0-9_-]+)(?:[/?#]|$)/i
        );

    if (resultado) {

        const tag =
            codificarCodigoTenor(resultado[1]);

        salvarLinkOriginal(
            tag,
            valor
        );

        return tag;
    }

    // Links diretos do Catbox podem ser preparados como imagem/vídeo também.
    try {
        const endereco = new URL(valor);
        const extensao = endereco.pathname.match(/\.(gif|png|jpe?g|webp|avif|mp4|webm|mov)$/i);
        if (
            endereco.protocol === "https:" &&
            endereco.hostname.toLowerCase() === "files.catbox.moe" &&
            extensao
        ) {
            return "img:" + encodeURIComponent(endereco.href);
        }
    } catch (erro) {
        // A entrada ainda pode estar incompleta enquanto a pessoa digita.
    }

    return null;
}


// ========================================
// IMAGEM
// ========================================

function limparPreviewImagem() {
    if (previewImagemUrl) {
        URL.revokeObjectURL(previewImagemUrl);
        previewImagemUrl = null;
    }

    const previewMedia = document.getElementById("kmc-image-preview-media");
    if (previewMedia) {
        previewMedia.replaceChildren();
    }
    document.getElementById("kmc-image-preview").style.display = "none";
}

function atualizarPreviaMensagemKMC() {
    const preview = document.getElementById("kmc-image-preview");
    const previewMedia = document.getElementById("kmc-image-preview-media");
    const previewMensagem = document.getElementById("kmc-message-preview");
    const mensagem = document.getElementById("kmc-caption").value.trim();
    const temMidia = previewMedia.hasChildNodes();

    previewMensagem.textContent = mensagem;
    previewMensagem.style.display = mensagem && temMidia ? "block" : "none";
    preview.style.display = temMidia ? "block" : "none";
}

function limparImagemOriginalSelecionada() {
    imagemOriginalSelecionada = null;
    imagemFoiEditada = false;
}

function mostrarPreviewImagem(file) {
    if (!file || !file.type || !file.type.startsWith("image/")) {
        alert("Escolha um arquivo de imagem.");
        return false;
    }

    limparPreviewImagem();
    imagemSelecionada = file;

    const preview = document.getElementById("kmc-image-preview-media");
    const moldura = document.createElement("div");
    moldura.style.position = "relative";
    moldura.style.display = "inline-block";
    moldura.style.maxWidth = "100%";

    const img = document.createElement("img");
    previewImagemUrl = URL.createObjectURL(file);
    img.src = previewImagemUrl;
    img.style.maxWidth = "180px";
    img.style.maxHeight = "120px";
    img.style.borderRadius = "8px";
    img.style.display = "block";

    const remover = document.createElement("button");
    remover.className = "kmc-remove";
    remover.type = "button";
    remover.title = "Remover imagem selecionada";
    remover.setAttribute("aria-label", "Remover imagem selecionada");
    Object.assign(remover.style, {
        position: "absolute",
        top: "5px",
        right: "5px",
        width: "28px",
        height: "28px",
        padding: "0",
        border: "1px solid rgba(255,255,255,.35)",
        borderRadius: "50%",
        background: "rgba(20,20,22,.88)",
        color: "#fff",
        fontSize: "21px",
        lineHeight: "1",
        cursor: "pointer",
        zIndex: "1"
    });

    const iconeX = document.createElement("span");
    Object.assign(iconeX.style, {
        position: "absolute",
        inset: "0",
        pointerEvents: "none"
    });
    for (const angulo of [45, -45]) {
        const linha = document.createElement("span");
        Object.assign(linha.style, {
            position: "absolute",
            left: "50%",
            top: "50%",
            width: "12px",
            height: "2px",
            borderRadius: "2px",
            background: "#fff",
            transform: `translate(-50%, -50%) rotate(${angulo}deg)`
        });
        iconeX.appendChild(linha);
    }
    remover.appendChild(iconeX);

    remover.addEventListener("click", evento => {
        evento.preventDefault();
        evento.stopPropagation();
        imagemSelecionada = null;
        limparImagemOriginalSelecionada();
        document.getElementById("kmc-file").value = "";
        limparPreviewImagem();
    });

    const camadaCorte = document.createElement("div");
    Object.assign(camadaCorte.style, {
        position: "absolute",
        inset: "0",
        display: "none",
        overflow: "hidden",
        cursor: "crosshair",
        touchAction: "none",
        zIndex: "1"
    });

    const caixaCorte = document.createElement("div");
    Object.assign(caixaCorte.style, {
        position: "absolute",
        border: "2px solid #53fc18",
        background: "rgba(83,252,24,.16)",
        boxSizing: "border-box",
        boxShadow: "0 0 0 9999px rgba(0,0,0,.48)",
        pointerEvents: "auto",
        cursor: "move"
    });

    for (const [nome, topo, esquerda, cursor] of [
        ["nw", "0", "0", "nwse-resize"],
        ["ne", "0", "100%", "nesw-resize"],
        ["sw", "100%", "0", "nesw-resize"],
        ["se", "100%", "100%", "nwse-resize"]
    ]) {
        const alca = document.createElement("div");
        alca.dataset.canto = nome;
        Object.assign(alca.style, {
            position: "absolute",
            top: topo,
            left: esquerda,
            width: "12px",
            height: "12px",
            transform: "translate(-50%, -50%)",
            border: "2px solid #53fc18",
            borderRadius: "2px",
            boxSizing: "border-box",
            background: "#fff",
            cursor,
            pointerEvents: "auto"
        });
        caixaCorte.appendChild(alca);
    }
    camadaCorte.appendChild(caixaCorte);

    remover.style.zIndex = "2";
    moldura.append(img, camadaCorte, remover);

    const barraEdicao = document.createElement("div");
    barraEdicao.className = "kmc-edit-toolbar";

    const criarBotaoEdicao = (rotulo, dica) => {
        const botaoEdicao = document.createElement("button");
        botaoEdicao.type = "button";
        botaoEdicao.textContent = rotulo;
        botaoEdicao.title = dica;
        botaoEdicao.addEventListener("click", evento => {
            evento.preventDefault();
            evento.stopPropagation();
        });
        return botaoEdicao;
    };

    const podeEditar = ["image/png", "image/jpeg", "image/webp", "image/avif", "image/bmp"].includes(file.type);
    const girarEsquerda = criarBotaoEdicao("↶ 90°", "Girar para a esquerda");
    const girarDireita = criarBotaoEdicao("↷ 90°", "Girar para a direita");
    const botaoCorte = criarBotaoEdicao("✂ Cortar", "Selecionar uma área para cortar");
    const aplicarCorte = criarBotaoEdicao("Aplicar", "Aplicar o corte selecionado");
    const voltarOriginal = criarBotaoEdicao("↩ Voltar ao original", "Desfazer cortes e giros");
    voltarOriginal.className = "kmc-restore-image";
    voltarOriginal.textContent = "↩ Voltar ao original";
    voltarOriginal.style.display = imagemFoiEditada ? "block" : "none";
    aplicarCorte.disabled = true;

    for (const botaoEdicao of [girarEsquerda, girarDireita, botaoCorte, aplicarCorte]) {
        botaoEdicao.disabled = !podeEditar;
    }

    const orientacaoCorte = document.createElement("div");
    orientacaoCorte.textContent = podeEditar
        ? "Gire a imagem ou selecione uma área para cortar."
        : (file.type === "image/gif" ? "GIFs animados não podem ser editados sem perder a animação." : "Use PNG, JPG, WebP, AVIF ou BMP para cortar e girar.");
    Object.assign(orientacaoCorte.style, {
        marginTop: "5px",
        color: "#aaa",
        fontSize: "11px",
        lineHeight: "1.35"
    });

    barraEdicao.append(girarEsquerda, girarDireita, botaoCorte, aplicarCorte);
    preview.append(moldura, barraEdicao, voltarOriginal, orientacaoCorte);

    voltarOriginal.addEventListener("click", () => {
        if (!imagemOriginalSelecionada) return;
        imagemFoiEditada = false;
        mostrarPreviewImagem(imagemOriginalSelecionada);
    });

    girarEsquerda.addEventListener("click", async () => {
        const editada = await transformarImagemSelecionada(-90);
        if (editada) {
            imagemFoiEditada = true;
            mostrarPreviewImagem(editada);
        }
    });

    girarDireita.addEventListener("click", async () => {
        const editada = await transformarImagemSelecionada(90);
        if (editada) {
            imagemFoiEditada = true;
            mostrarPreviewImagem(editada);
        }
    });

    let pontoInicial = null;
    let recorteSelecionado = null;
    let modoArraste = "novo";
    let cantoAtivo = null;
    let retanguloInicial = null;
    const atualizarCaixaCorte = (x1, y1, x2, y2) => {
        caixaCorte.style.left = `${Math.min(x1, x2)}px`;
        caixaCorte.style.top = `${Math.min(y1, y2)}px`;
        caixaCorte.style.width = `${Math.abs(x2 - x1)}px`;
        caixaCorte.style.height = `${Math.abs(y2 - y1)}px`;
    };
    const lerRetanguloCorte = () => ({
        x: parseFloat(caixaCorte.style.left) || 0,
        y: parseFloat(caixaCorte.style.top) || 0,
        largura: parseFloat(caixaCorte.style.width) || 0,
        altura: parseFloat(caixaCorte.style.height) || 0
    });

    botaoCorte.addEventListener("click", () => {
        const iniciando = camadaCorte.style.display === "none";
        img.style.maxWidth = iniciando ? "280px" : "180px";
        img.style.maxHeight = iniciando ? "280px" : "120px";
        camadaCorte.style.display = iniciando ? "block" : "none";
        botaoCorte.textContent = iniciando ? "Cancelar" : "✂ Cortar";
        orientacaoCorte.textContent = iniciando
            ? "Arraste para marcar; ajuste pelos quadrados ou arraste dentro para mover."
            : "Gire a imagem ou selecione uma área para cortar.";
        aplicarCorte.disabled = true;
        recorteSelecionado = null;
        modoArraste = "novo";
        cantoAtivo = null;
        retanguloInicial = null;
        caixaCorte.style.left = "0px";
        caixaCorte.style.top = "0px";
        caixaCorte.style.width = "0";
        caixaCorte.style.height = "0";
        requestAnimationFrame(() => {
            if (painel.style.display !== "none") posicionarPainel();
        });
    });

    const pontoNaImagem = evento => {
        const limites = img.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(limites.width, evento.clientX - limites.left)),
            y: Math.max(0, Math.min(limites.height, evento.clientY - limites.top)),
            largura: limites.width,
            altura: limites.height
        };
    };

    camadaCorte.addEventListener("pointerdown", evento => {
        evento.preventDefault();
        evento.stopPropagation();
        pontoInicial = pontoNaImagem(evento);
        const alca = evento.target.closest?.("[data-canto]");

        if (alca && recorteSelecionado) {
            modoArraste = "redimensionar";
            cantoAtivo = alca.dataset.canto;
            retanguloInicial = lerRetanguloCorte();
        } else if (evento.target === caixaCorte && recorteSelecionado) {
            modoArraste = "mover";
            retanguloInicial = lerRetanguloCorte();
        } else {
            modoArraste = "novo";
            cantoAtivo = null;
            retanguloInicial = null;
            recorteSelecionado = null;
            aplicarCorte.disabled = true;
            atualizarCaixaCorte(pontoInicial.x, pontoInicial.y, pontoInicial.x, pontoInicial.y);
        }
        camadaCorte.setPointerCapture(evento.pointerId);
    });

    camadaCorte.addEventListener("pointermove", evento => {
        if (!pontoInicial) return;
        const ponto = pontoNaImagem(evento);

        if (modoArraste === "novo") {
            atualizarCaixaCorte(pontoInicial.x, pontoInicial.y, ponto.x, ponto.y);
            return;
        }
        if (!retanguloInicial) return;

        if (modoArraste === "mover") {
            const x = Math.max(0, Math.min(
                ponto.largura - retanguloInicial.largura,
                retanguloInicial.x + ponto.x - pontoInicial.x
            ));
            const y = Math.max(0, Math.min(
                ponto.altura - retanguloInicial.altura,
                retanguloInicial.y + ponto.y - pontoInicial.y
            ));
            atualizarCaixaCorte(x, y, x + retanguloInicial.largura, y + retanguloInicial.altura);
            return;
        }

        let { x, y, largura, altura } = retanguloInicial;
        let direita = x + largura;
        let baixo = y + altura;
        const minimo = 12;
        if (cantoAtivo.includes("w")) x = Math.max(0, Math.min(direita - minimo, ponto.x));
        if (cantoAtivo.includes("e")) direita = Math.min(ponto.largura, Math.max(x + minimo, ponto.x));
        if (cantoAtivo.includes("n")) y = Math.max(0, Math.min(baixo - minimo, ponto.y));
        if (cantoAtivo.includes("s")) baixo = Math.min(ponto.altura, Math.max(y + minimo, ponto.y));
        atualizarCaixaCorte(x, y, direita, baixo);
    });

    camadaCorte.addEventListener("pointerup", evento => {
        if (!pontoInicial) return;
        const ponto = pontoNaImagem(evento);
        if (modoArraste === "novo") {
            atualizarCaixaCorte(pontoInicial.x, pontoInicial.y, ponto.x, ponto.y);
        }
        const retangulo = lerRetanguloCorte();
        if (retangulo.largura >= 12 && retangulo.altura >= 12 && ponto.largura && ponto.altura) {
            recorteSelecionado = {
                x: retangulo.x / ponto.largura,
                y: retangulo.y / ponto.altura,
                largura: retangulo.largura / ponto.largura,
                altura: retangulo.altura / ponto.altura
            };
            aplicarCorte.disabled = false;
        }
        pontoInicial = null;
        cantoAtivo = null;
        retanguloInicial = null;
    });

    camadaCorte.addEventListener("pointercancel", () => {
        pontoInicial = null;
        cantoAtivo = null;
        retanguloInicial = null;
    });

    aplicarCorte.addEventListener("click", async () => {
        if (!recorteSelecionado) return;
        const editada = await transformarImagemSelecionada(0, recorteSelecionado);
        if (editada) {
            imagemFoiEditada = true;
            mostrarPreviewImagem(editada);
        }
    });

    atualizarPreviaMensagemKMC();
    if (painel.style.display !== "none") posicionarPainel();
    document.getElementById("kmc-url").value = "";
    document.getElementById("kmc-copy-code").style.display = "none";
    return true;
}

async function transformarImagemSelecionada(rotacao, recorte = null) {
    const arquivoOriginal = imagemSelecionada;
    if (!arquivoOriginal || !["image/png", "image/jpeg", "image/webp", "image/avif", "image/bmp"].includes(arquivoOriginal.type)) {
        return null;
    }

    try {
        const urlTemporaria = URL.createObjectURL(arquivoOriginal);
        let imagem;
        try {
            imagem = new Image();
            imagem.src = urlTemporaria;
            await imagem.decode();
        } finally {
            URL.revokeObjectURL(urlTemporaria);
        }

        const canvas = document.createElement("canvas");
        const contexto = canvas.getContext("2d");
        if (!contexto) throw new Error("Canvas indisponível");

        if (recorte) {
            const origemX = Math.round(recorte.x * imagem.naturalWidth);
            const origemY = Math.round(recorte.y * imagem.naturalHeight);
            const largura = Math.max(1, Math.round(recorte.largura * imagem.naturalWidth));
            const altura = Math.max(1, Math.round(recorte.altura * imagem.naturalHeight));
            canvas.width = Math.min(largura, imagem.naturalWidth - origemX);
            canvas.height = Math.min(altura, imagem.naturalHeight - origemY);
            contexto.drawImage(
                imagem,
                origemX,
                origemY,
                canvas.width,
                canvas.height,
                0,
                0,
                canvas.width,
                canvas.height
            );
        } else {
            const trocaLados = Math.abs(rotacao) === 90;
            canvas.width = trocaLados ? imagem.naturalHeight : imagem.naturalWidth;
            canvas.height = trocaLados ? imagem.naturalWidth : imagem.naturalHeight;
            contexto.translate(canvas.width / 2, canvas.height / 2);
            contexto.rotate((rotacao * Math.PI) / 180);
            contexto.drawImage(
                imagem,
                -imagem.naturalWidth / 2,
                -imagem.naturalHeight / 2
            );
        }

        const tipoSaida = arquivoOriginal.type === "image/jpeg" ? "image/jpeg" : "image/png";
        const blob = await new Promise(resolve =>
            canvas.toBlob(resolve, tipoSaida, tipoSaida === "image/jpeg" ? 0.92 : undefined)
        );
        if (!blob) throw new Error("Não foi possível gerar a imagem editada");
        const extensao = tipoSaida === "image/jpeg" ? "jpg" : "png";
        return new File([blob], `kickmedia-editada-${Date.now()}.${extensao}`, {
            type: tipoSaida,
            lastModified: Date.now()
        });
    } catch (erro) {
        console.error("KickMediaChat - erro ao editar imagem:", erro);
        alert("Não foi possível editar essa imagem.");
        return null;
    }
}

function selecionarImagem(file) {

    if (fazendoUpload) {
        return;
    }

    imagemOriginalSelecionada = file;
    imagemFoiEditada = false;
    mostrarPreviewImagem(file);
}

document.getElementById(
    "kmc-image"
).addEventListener(
    "click",
    evento => {

        evento.stopPropagation();

        document.getElementById(
            "kmc-file"
        ).click();
    }
);

document.getElementById(
    "kmc-file"
).addEventListener(
    "change",
    evento => {

        const file =
            evento.target.files[0];

        if (file) {
            selecionarImagem(file);
        }
        evento.target.value = "";
    }
);

function atualizarLinkColado() {
    const campo = document.getElementById("kmc-url");
    const botaoCopiar = document.getElementById("kmc-copy-code");
    const valor = campo.value.trim();

    if (gifKlipySelecionado && gifKlipySelecionado.url !== valor) {
        gifKlipySelecionado = null;
    }

    imagemSelecionada = null;
    limparImagemOriginalSelecionada();
    document.getElementById("kmc-file").value = "";
    limparPreviewImagem();

    if (!valor) {
        botaoCopiar.style.display = "none";
        return;
    }

    const tag = converterEnderecoParaTag(valor);
    if (!tag) {
        botaoCopiar.style.display = "none";
        return;
    }

    campo.value = tag;
    botaoCopiar.style.display = "block";

    let media = null;
    if (/^gph:/i.test(tag)) {
        media = criarImagemGiphy(decodificarCodigoGiphy(tag) || tag.slice(4));
    } else if (/^klp:/i.test(tag)) {
        const url = decodificarCodigoKlipy(tag);
        if (url) {
            media = criarImagemKlipy(url);
        } else {
            const slug = extrairSlugCodigoKlipy(tag);
            if (slug) {
                solicitarUrlKlipyPorSlugKMC(slug).then(urlResolvida => {
                    if (campo.value !== tag) return;
                    const imagemResolvida = criarImagemKlipy(urlResolvida);
                    imagemResolvida.style.maxWidth = "180px";
                    imagemResolvida.style.maxHeight = "120px";
                    imagemResolvida.style.borderRadius = "8px";
                    imagemResolvida.style.display = "block";
                    imagemResolvida.src = imagemResolvida.dataset.kmcSrc;
                    const preview = document.getElementById("kmc-image-preview-media");
                    preview.replaceChildren(imagemResolvida);
                    atualizarPreviaMensagemKMC();
                }).catch(() => {});
            }
        }
    } else if (extrairIdCodigoKlipy(tag)) {
        solicitarUrlKlipyPorSlugKMC(extrairIdCodigoKlipy(tag), "id").then(url => {
            if (campo.value !== tag) return;
            const imagem = criarImagemKlipy(url);
            imagem.style.maxWidth = "180px";
            imagem.style.maxHeight = "120px";
            imagem.style.display = "block";
            imagem.src = imagem.dataset.kmcSrc;
            document.getElementById("kmc-image-preview-media").replaceChildren(imagem);
            atualizarPreviaMensagemKMC();
        }).catch(() => {});
    } else if (/^tnr:/i.test(tag)) {
        media = criarImagemTenor(decodificarCodigoTenor(tag));
    } else if (/^KMCGIF_TNR_/i.test(tag)) {
        media = criarImagemTenor(tag.replace(/^KMCGIF_TNR_/i, "").replace(/[._]GIF$/i, ""));
    } else if (/^(?:KMC_|KMCIMG_)/i.test(tag)) {
        const url = decodificarCodigoImagem(tag);
        if (url) media = criarImagemEnviada(url);
    } else if (/^img:https%3A/i.test(tag)) {
        try {
            const url = decodeURIComponent(tag.slice(4));
            if (/^https:\/\/files\.catbox\.moe\//i.test(url)) {
                media = criarImagemEnviada(url);
            }
        } catch (erro) {
            media = null;
        }
    }

    if (!media) return;

    media.style.maxWidth = "180px";
    media.style.maxHeight = "120px";
    media.style.borderRadius = "8px";
    media.style.display = "block";
    if (media.dataset.kmcSrc) {
        media.src = media.dataset.kmcSrc;
    }

    const preview = document.getElementById("kmc-image-preview-media");
    preview.replaceChildren(media);
    atualizarPreviaMensagemKMC();
}

document.getElementById("kmc-url").addEventListener("input", atualizarLinkColado);
document.getElementById("kmc-caption").addEventListener("input", atualizarPreviaMensagemKMC);

document.getElementById("kmc-copy-code").addEventListener("click", async evento => {
    evento.preventDefault();
    evento.stopPropagation();

    const campo = document.getElementById("kmc-url");
    const botao = evento.currentTarget;
    const codigo = campo.value.trim();
    if (!codigo || !converterEnderecoParaTag(codigo)) return;

    let copiado = false;
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(codigo);
            copiado = true;
        }
    } catch (erro) {
        // Tenta o método compatível com navegadores que bloqueiam Clipboard API.
    }

    if (!copiado) {
        const auxiliar = document.createElement("textarea");
        auxiliar.value = codigo;
        auxiliar.style.position = "fixed";
        auxiliar.style.opacity = "0";
        document.body.appendChild(auxiliar);
        auxiliar.select();
        try {
            copiado = document.execCommand("copy");
        } catch (erro) {
            copiado = false;
        }
        auxiliar.remove();
    }

    botao.textContent = copiado ? "✅ Código copiado!" : "Não foi possível copiar";
    setTimeout(() => { botao.textContent = "📋 Copiar código"; }, 1500);
});

const areaDrop =
    document.getElementById(
        "kmc-drop"
    );

areaDrop.addEventListener(
    "click",
    evento => {

        evento.stopPropagation();

        document.getElementById(
            "kmc-file"
        ).click();
    }
);

areaDrop.addEventListener(
    "dragenter",
    evento => {

        evento.preventDefault();
        evento.stopPropagation();

        areaDrop.style.borderColor =
            "#53fc18";

        areaDrop.style.color =
            "#53fc18";
    }
);

areaDrop.addEventListener(
    "dragover",
    evento => {

        evento.preventDefault();
        evento.stopPropagation();

        areaDrop.style.borderColor =
            "#53fc18";

        areaDrop.style.color =
            "#53fc18";
    }
);

areaDrop.addEventListener(
    "dragleave",
    evento => {

        evento.preventDefault();
        evento.stopPropagation();

        areaDrop.style.borderColor =
            "#555";

        areaDrop.style.color =
            "#aaa";
    }
);

areaDrop.addEventListener(
    "drop",
    evento => {

        evento.preventDefault();
        evento.stopPropagation();

        areaDrop.style.borderColor =
            "#555";

        areaDrop.style.color =
            "#aaa";

        const arquivos =
            evento.dataTransfer.files;

        if (
            arquivos &&
            arquivos.length
        ) {

            selecionarImagem(
                arquivos[0]
            );
        }
    }
);


// ========================================
// UPLOAD PELO BACKGROUND
// ========================================

async function enviarImagemParaBackground(file) {
    erroUltimoUploadImagem = "";
    if (!file || !file.type || !file.type.startsWith("image/")) {
        erroUltimoUploadImagem = "O arquivo precisa ser uma imagem válida.";
        alert("O arquivo precisa ser uma imagem.");
        return null;
    }

    if (file.size > 20 * 1024 * 1024) {
        erroUltimoUploadImagem = "A imagem é grande demais (máximo de 20 MB).";
        alert(erroUltimoUploadImagem);
        return null;
    }

    // O content.js precisa estar carregado pela extensão para acessar chrome.runtime.
    const runtime = globalThis.chrome && globalThis.chrome.runtime;
    if (!runtime || typeof runtime.sendMessage !== "function") {
        erroUltimoUploadImagem = "A extensão não conseguiu iniciar o envio. Recarregue-a e atualize a página.";
        console.error("KickMediaChat: chrome.runtime indisponível. Recarregue a extensão e confirme que content.js está declarado no manifest.json.");
        alert("A extensão não conseguiu se comunicar com o processo de envio. Recarregue a extensão e a página.");
        return null;
    }

    let dadosBase64;
    try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binario = "";
        const tamanhoBloco = 0x8000;
        for (let inicio = 0; inicio < bytes.length; inicio += tamanhoBloco) {
            binario += String.fromCharCode(...bytes.subarray(inicio, inicio + tamanhoBloco));
        }
        dadosBase64 = btoa(binario);
    } catch (erro) {
        erroUltimoUploadImagem = "Não foi possível preparar a imagem.";
        console.error("KickMediaChat: não foi possível preparar a imagem:", erro);
        return null;
    }

    return new Promise(resolve => {
        try {
            runtime.sendMessage(
                {
                    tipo: "KMC_UPLOAD_IMAGEM",
                    dadosBase64,
                    mime: file.type || "application/octet-stream",
                    nome: file.name || "imagem.png"
                },
                resposta => {
                    const erro = runtime.lastError;
                    if (erro) {
                        erroUltimoUploadImagem = erro.message || "Falha de comunicação com a extensão.";
                        console.error("KickMediaChat: erro de comunicação:", erro.message);
                        resolve(null);
                        return;
                    }

                    if (!resposta || !resposta.sucesso || !resposta.url) {
                        erroUltimoUploadImagem = resposta && resposta.erro
                            ? resposta.erro
                            : "O serviço de hospedagem não retornou um link.";
                        console.error("KickMediaChat: erro ao enviar imagem:", resposta && resposta.erro ? resposta.erro : "Sem resposta válida.");
                        resolve(null);
                        return;
                    }

                    resolve(resposta.url);
                }
            );
        } catch (erro) {
            erroUltimoUploadImagem = erro && erro.message
                ? erro.message
                : "Falha de comunicação com o serviço de hospedagem.";
            console.error("KickMediaChat: falha ao chamar o processo de envio:", erro);
            resolve(null);
        }
    });
}


// ========================================
// CAMPO DO CHAT
// ========================================

function encontrarCampoChat() {

    const campos = [
        ...document.querySelectorAll(SELETOR_CAMPO_EDITAVEL)
    ].filter(elemento => {

        const rect =
            elemento.getBoundingClientRect();

        if (
            rect.width === 0 ||
            rect.height === 0
        ) {
            return false;
        }

        const texto = (
            elemento.getAttribute(
                "placeholder"
            ) || ""
        ).toLowerCase();

        return (
            texto.includes("message") ||
            texto.includes("mensagem") ||
            texto.includes("chat") ||
            elemento.isContentEditable ||
            elemento.getAttribute("role") === "textbox"
        );
    });

    if (!campos.length) {
        return null;
    }

    return campos.sort((a, b) => {

        const ra =
            a.getBoundingClientRect();

        const rb =
            b.getBoundingClientRect();

        const distanciaA =
            Math.abs(
                window.innerWidth - ra.right
            ) +
            Math.abs(
                window.innerHeight - ra.bottom
            );

        const distanciaB =
            Math.abs(
                window.innerWidth - rb.right
            ) +
            Math.abs(
                window.innerHeight - rb.bottom
            );

        return distanciaA - distanciaB;

    })[0];
}

function campoAlvoEhChatKMC(campo) {
    return Boolean(
        campo instanceof Element &&
        campo.matches(SELETOR_CAMPO_EDITAVEL) &&
        !campo.closest("#kmc-panel, #kmc-gif-panel") &&
        encontrarCampoChat() === campo
    );
}

// Mantém marcado o editor real da Kick. O leitor de códigos deve ignorar
// qualquer conteúdo digitado ou colado dentro da caixa de mensagem.
function marcarCampoChatKMC() {
    const campo = encontrarCampoChat();

    if (campo) {
        campo.setAttribute("data-kmc-chat-input", "true");
    }

    const ativo = document.activeElement;
    if (ativo instanceof Element) {
        const campoAtivo = ativo.closest(SELETOR_CAMPO_EDITAVEL);
        if (campoAtivo) campoAtivo.setAttribute("data-kmc-chat-input", "true");
    }

    return campo;
}

function estaDentroDoCampoChatKMC(elemento) {
    if (!elemento || elemento.nodeType !== Node.ELEMENT_NODE) {
        return false;
    }

    if (
        elemento.closest('[data-kmc-chat-input="true"]') ||
        elemento.matches(SELETOR_CAMPO_EDITAVEL) ||
        elemento.closest(SELETOR_CAMPO_EDITAVEL)
    ) {
        return true;
    }

    return false;
}

// Se o mesmo código ainda está escrito em uma caixa editável, ele ainda não
// foi enviado. Isso evita converter a prévia do texto colado no compositor.
function codigoAindaEstaSendoDigitadoKMC(codigo) {
    const procurado = String(codigo || "").trim();
    if (!procurado) return false;

    const chave = procurado.toLowerCase();
    const expiraEm = codigosColadosRecentementeKMC.get(chave);
    const aindaNoEditor = [...document.querySelectorAll(SELETOR_CAMPO_EDITAVEL)].some(campo => {
        const conteudo = campo.value ?? campo.innerText ?? campo.textContent ?? "";
        return String(conteudo).includes(procurado);
    });

    if (expiraEm === Infinity) {
        // Só libera depois de detectar Enter, envio do formulário ou clique
        // em Enviar. Assim, esperar ou tirar o foco não libera o GIF.
        return true;
    }

    if (expiraEm !== undefined) {
        if (expiraEm > Date.now()) return true;
        codigosColadosRecentementeKMC.delete(chave);
    }

    return aindaNoEditor;
}


// ========================================
// COLOCAR TEXTO PURO
// ========================================

function colocarTextoNoCampo(
    campo,
    mensagem
) {
    campo.focus();
    const texto = String(mensagem);

    if (campo.tagName === "TEXTAREA" || campo.tagName === "INPUT") {
        const prototype = campo.tagName === "TEXTAREA"
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

        if (descriptor && descriptor.set) {
            descriptor.set.call(campo, texto);
        } else {
            campo.value = texto;
        }

        campo.dispatchEvent(new Event("input", { bubbles: true }));
        return;
    }

    const selecao = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(campo);

    if (selecao) {
        selecao.removeAllRanges();
        selecao.addRange(range);
    }

    // insertText já dispara o evento input no contenteditable.
    // Um segundo InputEvent repetia a tag enviada na Kick.
    document.execCommand("insertText", false, texto);
}


// ========================================
// ENVIAR SOMENTE TEXTO
// ========================================

function enviarMensagemChat(
    mensagem
) {

    return new Promise(resolve => {

        const campo =
            encontrarCampoChat();

        if (!campo) {

            alert(
                "Não encontrei a caixa de mensagem do chat."
            );

            resolve(false);
            return;
        }

        const texto =
            String(mensagem);

        colocarTextoNoCampo(
            campo,
            texto
        );

        setTimeout(() => {

            campo.focus();

            // IMPORTANTE:
            // Enviamos SOMENTE keydown.
            // O keyup antigo podia fazer a Kick
            // interpretar a mensagem duas vezes.

            const eventoEnter =
                new KeyboardEvent(
                    "keydown",
                    {
                        key: "Enter",
                        code: "Enter",
                        keyCode: 13,
                        which: 13,
                        bubbles: true,
                        cancelable: true
                    }
                );

            campo.dispatchEvent(
                eventoEnter
            );

            setTimeout(() => {

                resolve(true);

            }, 700);

        }, 300);
    });
}


// ========================================
// ENVIAR
// ========================================

document.getElementById(
    "kmc-send"
).addEventListener(
    "click",
    async evento => {

        evento.stopPropagation();

        if (
            enviandoMensagem ||
            fazendoUpload
        ) {
            return;
        }

        const campoUrl =
            document.getElementById(
                "kmc-url"
            );

        let valor =
            campoUrl.value.trim();

        if (imagemSelecionada) {

            fazendoUpload =
                true;

            const botaoEnviar =
                document.getElementById(
                    "kmc-send"
                );

            botaoEnviar.disabled =
                true;

            botaoEnviar.textContent =
                "⏳ Enviando imagem...";

            try {

                const url =
                    await enviarImagemParaBackground(
                        imagemSelecionada
                    );

                if (!url) {

                    alert(
                        "Não foi possível enviar a imagem." +
                        (erroUltimoUploadImagem ? "\n" + erroUltimoUploadImagem : "")
                    );

                    botaoEnviar.disabled =
                        false;

                    botaoEnviar.textContent =
                        "📤 Enviar";

                    fazendoUpload =
                        false;

                    return;
                }

                const codigo =
                    codificarImagem(url);

                if (!codigo) {

                    alert(
                        "Não foi possível preparar a imagem."
                    );

                    botaoEnviar.disabled =
                        false;

                    botaoEnviar.textContent =
                        "📤 Enviar";

                    fazendoUpload =
                        false;

                    return;
                }

                valor = codigo;
                campoUrl.value = valor;
                document.getElementById("kmc-copy-code").style.display = "block";

                imagemSelecionada =
                    null;
                limparImagemOriginalSelecionada();

                limparPreviewImagem();
                const arquivo =
                    document.getElementById(
                        "kmc-file"
                    );

                arquivo.value = "";

            } catch (erro) {

                console.error(
                    "KickMediaChat - erro ao enviar imagem:",
                    erro
                );

                alert(
                    "Erro ao enviar a imagem."
                );

                botaoEnviar.disabled =
                    false;

                botaoEnviar.textContent =
                    "📤 Enviar";

                fazendoUpload =
                    false;

                return;
            }

            fazendoUpload =
                false;
        }

        if (!valor) {

            alert(
                "Escolha um GIF, imagem ou cole um link primeiro!"
            );

            return;
        }

        let mensagem = null;
        const tag = converterEnderecoParaTag(valor);
        if (tag) mensagem = tag;

        if (!mensagem) {

            alert(
                "Selecione um GIF, imagem ou cole um link válido."
            );

            return;
        }

        mensagem = montarMensagemComMidia(
            document.getElementById("kmc-caption").value,
            mensagem
        );

        enviandoMensagem =
            true;

        const botaoEnviar =
            document.getElementById(
                "kmc-send"
            );

        botaoEnviar.disabled =
            true;

        botaoEnviar.textContent =
            "⏳ Enviando...";

        const enviado =
            await enviarMensagemChat(
                mensagem
            );

        if (enviado) {
            const compartilhamentoKlipy = gifKlipySelecionado;
            if (compartilhamentoKlipy?.slug) {
                chrome.runtime.sendMessage({
                    tipo: "KMC_KLIPY_COMPARTILHADO",
                    slug: compartilhamentoKlipy.slug,
                    consulta: compartilhamentoKlipy.consulta
                }, () => {
                    if (chrome.runtime.lastError) {
                        console.warn("KICKShot: não foi possível registrar o compartilhamento na KLIPY.");
                    }
                });
            }
            gifKlipySelecionado = null;

            setTimeout(() => {

                campoUrl.value =
                    "";
                document.getElementById("kmc-caption").value = "";
                document.getElementById("kmc-copy-code").style.display = "none";

                imagemSelecionada =
                    null;
                limparImagemOriginalSelecionada();

                document.getElementById(
                    "kmc-file"
                ).value = "";

                limparPreviewImagem();

                fecharPainelAnimado(painel);
                fecharPainelAnimado(gifPainel);

                botaoEnviar.disabled =
                    false;

                botaoEnviar.textContent =
                    "📤 Enviar";

                enviandoMensagem =
                    false;
                procurarGifsNoChat();

            }, 200);

        } else {

            botaoEnviar.disabled =
                false;

            botaoEnviar.textContent =
                "📤 Enviar";

            enviandoMensagem =
                false;
        }
    }
);


// ========================================
// KLIPY e compatibilidade com GIFs GIPHY antigos
// ========================================

function abrirMidiaAmpliadaKMC(midia) {
    if (!midia || !midia.src) return;

    let visualizador = document.getElementById("kmc-media-viewer");
    if (!visualizador) {
        visualizador = document.createElement("div");
        visualizador.id = "kmc-media-viewer";
        Object.assign(visualizador.style, {
            position: "fixed",
            inset: "0",
            zIndex: "2147483647",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            boxSizing: "border-box",
            background: "rgba(0, 0, 0, 0.88)",
            cursor: "zoom-out"
        });

        visualizador.addEventListener("click", () => visualizador.remove());
        document.body.appendChild(visualizador);
    }

    visualizador.replaceChildren();
    const ampliada = document.createElement("img");
    ampliada.src = midia.currentSrc || midia.src;
    ampliada.alt = midia.alt || "Imagem ampliada";
    Object.assign(ampliada.style, {
        display: "block",
        maxWidth: "min(96vw, 1400px)",
        maxHeight: "92vh",
        objectFit: "contain",
        borderRadius: "8px",
        cursor: "zoom-out"
    });
    ampliada.addEventListener("click", evento => {
        evento.stopPropagation();
        visualizador.remove();
    });
    visualizador.appendChild(ampliada);
}

document.addEventListener("keydown", evento => {
    if (evento.key === "Escape") {
        document.getElementById("kmc-media-viewer")?.remove();
    }
});

document.addEventListener("click", evento => {
    const midia = evento.target.closest?.('img[data-kmc-media="true"]');
    if (!midia || midia.closest("#kmc-panel, #kmc-gif-panel, #kmc-media-viewer")) return;
    evento.preventDefault();
    evento.stopPropagation();
    abrirMidiaAmpliadaKMC(midia);
}, true);

function prepararCliqueParaAmpliarKMC(imagem) {
    imagem.style.cursor = "zoom-in";
    imagem.title = "Clique para ampliar";
    return imagem;
}

function criarImagemGiphy(id) {

    const imagem =
        document.createElement("img");

    imagem.dataset.kmcMedia =
        "true";

    const linkOriginal =
        obterLinkOriginal(codificarCodigoGiphy(id)) ||
        obterLinkOriginal("gph:" + id);

    if (linkOriginal) {

        imagem.dataset.kmcSrc =
            linkOriginal;

    } else {

        imagem.dataset.kmcSrc =
            "https://media.giphy.com/media/" +
            encodeURIComponent(id) +
            "/giphy.gif";
    }

    imagem.alt =
        "GIF";

    imagem.style.maxWidth =
        "220px";

    imagem.style.maxHeight =
        "220px";

    imagem.style.borderRadius =
        "8px";

    imagem.style.display =
        "block";

    imagem.onerror =
        () => {

            const alternativa =
                "https://i.giphy.com/" +
                encodeURIComponent(id) +
                ".gif";

            if (
                imagem.src !==
                alternativa
            ) {

                imagem.dataset.kmcSrc =
                    alternativa;
                imagem.src =
                    alternativa;
            }
        };

    return prepararCliqueParaAmpliarKMC(imagem);
}

function criarImagemKlipy(url) {
    const imagem = document.createElement("img");
    imagem.dataset.kmcMedia = "true";
    imagem.dataset.kmcSrc = url;
    imagem.alt = "GIF da KLIPY";
    imagem.style.maxWidth = "220px";
    imagem.style.maxHeight = "220px";
    imagem.style.borderRadius = "8px";
    imagem.style.display = "block";
    return prepararCliqueParaAmpliarKMC(imagem);
}


// ========================================
// TENOR
// ========================================

function criarImagemTenor(id) {

    const imagem =
        document.createElement("img");

    imagem.dataset.kmcMedia =
        "true";

    const tag =
        codificarCodigoTenor(id);

    const linkOriginal =
        obterLinkOriginal(tag) || obterLinkOriginal("tnr:" + id) || obterLinkOriginal("KMCGIF_TNR_" + id);

    if (linkOriginal) {

        let url =
            linkOriginal;

        const convertido =
            url.match(
                /media1\.tenor\.com\/m\/([A-Za-z0-9_-]+)(?:\/[^/?#]+)?/i
            );

        if (convertido) {

            url =
                "https://media.tenor.com/" +
                convertido[1] +
                "/tenor.gif";
        }

        imagem.dataset.kmcSrc =
            url;

    } else {

        imagem.dataset.kmcSrc =
            "https://media.tenor.com/" +
            encodeURIComponent(id) +
            "/tenor.gif";
    }

    imagem.alt =
        "GIF";

    imagem.style.maxWidth =
        "220px";

    imagem.style.maxHeight =
        "220px";

    imagem.style.borderRadius =
        "8px";

    imagem.style.display =
        "block";

    imagem.onerror =
        () => {

            const alternativa =
                "https://c.tenor.com/" +
                encodeURIComponent(id) +
                "/tenor.gif";

            if (
                imagem.src !==
                alternativa
            ) {

                imagem.dataset.kmcSrc =
                    alternativa;
                imagem.src =
                    alternativa;
            }
        };

    return prepararCliqueParaAmpliarKMC(imagem);
}


// ========================================
// IMAGEM ENVIADA
// ========================================

function criarImagemEnviada(url) {

    const urlLimpa =
        String(url).split("?")[0].toLowerCase();

    // Se for vídeo, cria vídeo.
    if (
        urlLimpa.endsWith(".mp4") ||
        urlLimpa.endsWith(".webm") ||
        urlLimpa.endsWith(".mov")
    ) {

        const video =
            document.createElement("video");

        video.dataset.kmcMedia =
            "true";

        video.dataset.kmcSrc =
            url;

        video.controls =
            true;

        video.autoplay =
            false;

        video.loop =
            true;

        video.muted =
            true;

        video.style.maxWidth =
            "220px";

        video.style.maxHeight =
            "220px";

        video.style.borderRadius =
            "8px";

        video.style.display =
            "block";

        return video;
    }

    const imagem =
        document.createElement("img");

    imagem.dataset.kmcMedia =
        "true";

    imagem.dataset.kmcSrc =
        url;

    imagem.alt =
        "Imagem";

    imagem.style.maxWidth =
        "220px";

    imagem.style.maxHeight =
        "220px";

    imagem.style.borderRadius =
        "8px";

    imagem.style.display =
        "block";

    return prepararCliqueParaAmpliarKMC(imagem);
}


// ========================================
// PROCESSAR KMCIMG
// ========================================

function encontrarNomeUsuarioDaMensagemKMC(elemento) {
    let contexto = elemento?.parentElement || null;
    const padraoNome = /^(?!\d+$)[A-Za-z0-9_-]{2,32}:?$/;

    for (let nivel = 0; contexto && nivel < 5; nivel++, contexto = contexto.parentElement) {
        const candidatos = [...contexto.querySelectorAll("span, a, strong, b, div")]
            .filter(candidato => {
                const nome = (candidato.textContent || "").trim().replace(/:$/, "");
                const estilo = getComputedStyle(candidato);
                return padraoNome.test(nome) &&
                    candidato.getClientRects().length > 0 &&
                    estilo.display !== "none" &&
                    estilo.visibility !== "hidden";
            })
            .sort((a, b) => a.contains(b) ? 1 : b.contains(a) ? -1 : 0);

        for (const candidato of candidatos) {
            if (candidato === elemento || candidato.contains(elemento) || elemento.contains(candidato)) {
                continue;
            }
            return candidato;
        }
    }

    return null;
}

function carregarMidiasBloqueadasKMC() {
    try {
        const salvas = JSON.parse(localStorage.getItem("kmc_midias_bloqueadas") || "[]");
        return Array.isArray(salvas) ? salvas.filter(item => typeof item === "string") : [];
    } catch (erro) {
        return [];
    }
}

let midiasBloqueadasKMC = carregarMidiasBloqueadasKMC();

function carregarHashesMidiasBloqueadasKMC() {
    try {
        const salvos = JSON.parse(localStorage.getItem("kmc_hashes_midias_bloqueadas") || "[]");
        return Array.isArray(salvos) ? salvos.filter(item => typeof item === "string") : [];
    } catch (erro) {
        console.error("KickMediaChat: não foi possível carregar os bloqueios por conteúdo.", erro);
        return [];
    }
}

let hashesMidiasBloqueadasKMC = carregarHashesMidiasBloqueadasKMC();
const hashesMidiasKMC = new Map();

function carregarMapaHashesMidiasBloqueadasKMC() {
    try {
        const salvo = JSON.parse(localStorage.getItem("kmc_mapa_hashes_midias_bloqueadas") || "{}");
        return salvo && typeof salvo === "object" && !Array.isArray(salvo)
            ? Object.fromEntries(Object.entries(salvo).filter(([, hash]) => typeof hash === "string"))
            : {};
    } catch (erro) {
        console.error("KickMediaChat: não foi possível carregar o índice de bloqueios por conteúdo.", erro);
        return {};
    }
}

let mapaHashesMidiasBloqueadasKMC = carregarMapaHashesMidiasBloqueadasKMC();

function salvarHashesMidiasBloqueadasKMC() {
    try {
        localStorage.setItem("kmc_hashes_midias_bloqueadas", JSON.stringify(hashesMidiasBloqueadasKMC));
    } catch (erro) {
        console.warn("KickMediaChat: não foi possível salvar os bloqueios por conteúdo.", erro);
    }
}

function registrarHashBloqueioKMC(codigo, hash) {
    mapaHashesMidiasBloqueadasKMC[normalizarChaveMidiaKMC(codigo)] = hash;
    if (!hashesMidiasBloqueadasKMC.includes(hash)) {
        hashesMidiasBloqueadasKMC.push(hash);
    }
    try {
        localStorage.setItem("kmc_mapa_hashes_midias_bloqueadas", JSON.stringify(mapaHashesMidiasBloqueadasKMC));
    } catch (erro) {
        console.warn("KickMediaChat: não foi possível salvar o índice de bloqueios por conteúdo.", erro);
    }
    salvarHashesMidiasBloqueadasKMC();
}

function obterHashMidiaKMC(url) {
    if (hashesMidiasKMC.has(url)) {
        return hashesMidiasKMC.get(url);
    }

    const runtime = globalThis.chrome && globalThis.chrome.runtime;
    if (!runtime || typeof runtime.sendMessage !== "function") {
        return Promise.reject(new Error("A extensão não está disponível para verificar esta mídia."));
    }

    let consulta;
    consulta = new Promise((resolve, reject) => {
        runtime.sendMessage({ tipo: "KMC_HASH_MIDIA", url }, resposta => {
            if (runtime.lastError) {
                reject(new Error(runtime.lastError.message || "Não foi possível verificar a mídia."));
            } else if (!resposta?.sucesso || typeof resposta.hash !== "string") {
                reject(new Error(resposta?.erro || "Não foi possível verificar a mídia."));
            } else {
                resolve(resposta.hash);
            }
        });
    }).catch(erro => {
        if (hashesMidiasKMC.get(url) === consulta) {
            hashesMidiasKMC.delete(url);
        }
        throw erro;
    });

    hashesMidiasKMC.set(url, consulta);
    if (hashesMidiasKMC.size > 200) {
        hashesMidiasKMC.delete(hashesMidiasKMC.keys().next().value);
    }
    return consulta;
}

function normalizarChaveMidiaKMC(codigo) {
    return String(codigo || "").trim().toLowerCase();
}

function salvarMidiasBloqueadasKMC() {
    try {
        localStorage.setItem("kmc_midias_bloqueadas", JSON.stringify(midiasBloqueadasKMC));
    } catch (erro) {
        console.warn("KickMediaChat: não foi possível salvar as mídias bloqueadas.", erro);
    }
}

function criarBotaoBloqueioKMC(texto, titulo, aoClicar) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = texto;
    botao.title = titulo;
    botao.setAttribute("aria-label", titulo);
    Object.assign(botao.style, {
        flex: "0 0 auto",
        padding: "2px 5px",
        border: "0",
        borderRadius: "4px",
        background: "transparent",
        color: "#b9b9b9",
        fontSize: "13px",
        lineHeight: "1.2",
        cursor: "pointer"
    });
    botao.addEventListener("click", evento => {
        evento.preventDefault();
        evento.stopPropagation();
        aoClicar();
    });
    return botao;
}

function renderizarCodigoComMidia(elemento, codigo, url, midia, clicavel = true, legenda = "") {
    const legendaAntes = typeof legenda === "string" ? legenda : legenda.antes;
    const legendaDepois = typeof legenda === "string" ? "" : legenda.depois;
    const chaveBloqueio = normalizarChaveMidiaKMC(codigo);
    const bloco = document.createElement("div");
    bloco.dataset.kmcMedia = "true";
    Object.assign(bloco.style, {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "4px"
    });

    if (midiasBloqueadasKMC.includes(chaveBloqueio)) {
        const origemBloqueada = midia.dataset.kmcSrc || url;
        void obterHashMidiaKMC(origemBloqueada).then(hash => {
            midia.dataset.kmcBlockedHash = hash;
            registrarHashBloqueioKMC(codigo, hash);
        }).catch(erro => console.warn("KickMediaChat: não foi possível registrar a impressão digital da mídia bloqueada.", erro));
        midia.pause?.();
        midia.removeAttribute("src");
        midia.load?.();
        const aviso = document.createElement("span");
        aviso.textContent = "🚫 Mídia bloqueada";
        const botaoDesbloquear = criarBotaoBloqueioKMC("Desbloquear", "Desbloquear esta imagem ou GIF", async () => {
            let hashBloqueio = midia.dataset.kmcBlockedHash;
            if (!hashBloqueio && origemBloqueada) {
                try {
                    hashBloqueio = await obterHashMidiaKMC(origemBloqueada);
                } catch (erro) {
                    console.warn("KickMediaChat: não foi possível remover o bloqueio por conteúdo.", erro);
                }
            }
            midiasBloqueadasKMC = midiasBloqueadasKMC.filter(item => item !== chaveBloqueio);
            if (hashBloqueio) {
                registrarHashBloqueioKMC(codigo, hashBloqueio);
                const chavesDoHash = new Set(Object.entries(mapaHashesMidiasBloqueadasKMC)
                    .filter(([, hash]) => hash === hashBloqueio)
                    .map(([chave]) => chave));
                chavesDoHash.add(chaveBloqueio);
                midiasBloqueadasKMC = midiasBloqueadasKMC.filter(item => !chavesDoHash.has(item));
                for (const chave of chavesDoHash) {
                    delete mapaHashesMidiasBloqueadasKMC[chave];
                }
                hashesMidiasBloqueadasKMC = hashesMidiasBloqueadasKMC.filter(item => item !== hashBloqueio);
                try {
                    localStorage.setItem("kmc_mapa_hashes_midias_bloqueadas", JSON.stringify(mapaHashesMidiasBloqueadasKMC));
                } catch (erro) {
                    console.warn("KickMediaChat: não foi possível atualizar o índice de bloqueios por conteúdo.", erro);
                }
                salvarHashesMidiasBloqueadasKMC();
                delete midia.dataset.kmcBlockedHash;
            }
            salvarMidiasBloqueadasKMC();
            renderizarCodigoComMidia(elemento, codigo, url, midia, clicavel, legenda);
        });
        bloco.append(aviso, botaoDesbloquear);
        elemento.dataset.kmcProcessed = "true";
        elemento.replaceChildren(bloco);
        return;
    }

    const origemMidia = midia.dataset.kmcSrc || url;
    if (
        hashesMidiasBloqueadasKMC.length &&
        origemMidia &&
        elemento.dataset.kmcHashChecked !== origemMidia
    ) {
        if (elemento.dataset.kmcHashCheckPending === origemMidia) {
            return;
        }
        elemento.dataset.kmcHashCheckPending = origemMidia;
        void obterHashMidiaKMC(origemMidia).then(hash => {
            if (!elemento.isConnected) return;
            delete elemento.dataset.kmcHashCheckPending;
            elemento.dataset.kmcHashChecked = origemMidia;
            if (hashesMidiasBloqueadasKMC.includes(hash)) {
                midia.dataset.kmcBlockedHash = hash;
                registrarHashBloqueioKMC(codigo, hash);
                if (!midiasBloqueadasKMC.includes(chaveBloqueio)) {
                    midiasBloqueadasKMC.push(chaveBloqueio);
                    salvarMidiasBloqueadasKMC();
                }
            }
            renderizarCodigoComMidia(elemento, codigo, url, midia, clicavel, legenda);
        }).catch(erro => {
            if (!elemento.isConnected) return;
            delete elemento.dataset.kmcHashCheckPending;
            elemento.dataset.kmcHashChecked = origemMidia;
            console.warn("KickMediaChat: não foi possível comparar a mídia com a lista de bloqueios.", erro);
            renderizarCodigoComMidia(elemento, codigo, url, midia, clicavel, legenda);
        });
        return;
    }

    const fonteMidia = midia.dataset.kmcSrc;
    if (fonteMidia && midia.getAttribute("src") !== fonteMidia) {
        midia.src = fonteMidia;
    }

    const codigoKlipy = /^klp:/i.test(codigo);
    const linkCodigo = document.createElement("span");
    linkCodigo.textContent = codigoKlipy ? "KMC_KLIPY_GIF" : codigo;
    Object.assign(linkCodigo.style, {
        display: "inline-block",
        maxWidth: codigoKlipy ? "180px" : "100%",
        color: clicavel ? "#53fc18" : "#f1f1f1",
        fontSize: codigoKlipy ? "9px" : "11px",
        lineHeight: "1.4",
        textDecoration: clicavel ? "underline" : "none",
        overflowWrap: codigoKlipy ? "normal" : "anywhere",
        whiteSpace: codigoKlipy ? "nowrap" : "normal",
        overflow: codigoKlipy ? "hidden" : "visible",
        textOverflow: codigoKlipy ? "ellipsis" : "clip",
        cursor: clicavel ? "pointer" : "text",
        userSelect: "text"
    });
    if (codigoKlipy) linkCodigo.title = "Código completo da mídia KLIPY";

    if (clicavel) {
        linkCodigo.setAttribute("role", "link");
        linkCodigo.tabIndex = 0;
        linkCodigo.title = codigoKlipy ? "Abrir arquivo original; código completo ao copiar" : "Abrir arquivo original";
        if (codigoKlipy) {
            linkCodigo.addEventListener("copy", evento => {
                evento.preventDefault();
                evento.clipboardData?.setData("text/plain", codigo);
            });
        }
        linkCodigo.addEventListener("click", evento => {
            evento.preventDefault();
            evento.stopPropagation();
            window.open(url, "_blank", "noopener,noreferrer");
        });
        linkCodigo.addEventListener("keydown", evento => {
            if (evento.key === "Enter" || evento.key === " ") {
                evento.preventDefault();
                window.open(url, "_blank", "noopener,noreferrer");
            }
        });
    } else {
        linkCodigo.addEventListener("copy", evento => {
            evento.preventDefault();
            evento.clipboardData?.setData("text/plain", codigo);
        });
    }

    if (legendaAntes) {
        const textoLegenda = document.createElement("div");
        textoLegenda.textContent = legendaAntes;
        Object.assign(textoLegenda.style, {
            maxWidth: "100%",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            color: "inherit"
        });
        bloco.append(textoLegenda);
    }

    const linhaCodigo = document.createElement("div");
    Object.assign(linhaCodigo.style, {
        display: "flex",
        alignItems: "center",
        gap: "5px",
        maxWidth: "100%"
    });
    const botaoBloquear = criarBotaoBloqueioKMC("🚫", "Bloquear esta imagem ou GIF", () => {
        if (!midiasBloqueadasKMC.includes(chaveBloqueio)) {
            midiasBloqueadasKMC.push(chaveBloqueio);
            salvarMidiasBloqueadasKMC();
        }
        const origem = midia.dataset.kmcSrc || url;
        void obterHashMidiaKMC(origem).then(hash => {
            midia.dataset.kmcBlockedHash = hash;
            registrarHashBloqueioKMC(codigo, hash);
        }).catch(erro => console.warn("KickMediaChat: não foi possível salvar o bloqueio por conteúdo.", erro));
        renderizarCodigoComMidia(elemento, codigo, url, midia, clicavel, legenda);
    });
    linhaCodigo.append(linkCodigo, botaoBloquear);
    bloco.append(linhaCodigo, midia);

    if (legendaDepois) {
        const textoLegendaDepois = document.createElement("div");
        textoLegendaDepois.textContent = legendaDepois;
        Object.assign(textoLegendaDepois.style, {
            maxWidth: "100%",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            color: "inherit"
        });
        bloco.append(textoLegendaDepois);
    }

    elemento.dataset.kmcProcessed = "true";
    elemento.replaceChildren(bloco);
}

function processarCodigoKMC(
    elemento,
    texto,
    legenda = ""
) {

    if (
        !elemento ||
        !texto
    ) {
        return false;
    }

    const encontrado =
        texto.match(
            /(KMCIMG_[A-Za-z0-9_.-]+|KMC_[A-Za-z0-9_.-]+[._](?:IMG|GIF))/i
        );

    if (!encontrado) {
        return false;
    }

    const url =
        decodificarCodigoImagem(encontrado[0]);

    if (
        !url ||
        !/^https:\/\/files\.catbox\.moe\//i.test(
            url
        )
    ) {
        return false;
    }

    if (
        elemento.dataset &&
        elemento.dataset.kmcProcessed === "true"
    ) {
        return true;
    }

    const media =
        criarImagemEnviada(url);

    renderizarCodigoComMidia(elemento, encontrado[0], url, media, true, legenda);

    return true;
}


// ========================================
// PROCESSAR MENSAGEM
// ========================================

function processarElementoGif(elemento) {

    if (codigoColadoAguardandoEnvioKMC) {
        return false;
    }

    if (
        !elemento ||
        elemento.nodeType !== 1
    ) {
        return false;
    }

    if (
        elemento.dataset &&
        elemento.dataset.kmcProcessed ===
            "true"
    ) {
        return false;
    }

    if (
        elemento.dataset &&
        elemento.dataset.kmcMedia ===
            "true"
    ) {
        return false;
    }

    if (
        elemento.closest &&
        elemento.closest('[data-kmc-media="true"]')
    ) {
        return false;
    }

    if (
        elemento.closest &&
        elemento.closest(
            "#kmc-button, #kmc-panel, #kmc-gif-panel"
        )
    ) {
        return false;
    }

    if (
        elemento.matches &&
        elemento.matches(SELETOR_CAMPO_EDITAVEL)
    ) {
        return false;
    }

    if (
        elemento.closest &&
        elemento.closest(SELETOR_CAMPO_EDITAVEL)
    ) {
        return false;
    }

    if (estaDentroDoCampoChatKMC(elemento)) {
        return false;
    }

    if (
        elemento.querySelector &&
        elemento.querySelector(
            "img, video, picture, source"
        )
    ) {
        return false;
    }

    let texto =
        (elemento.textContent || "")
            .trim();

    let legenda = { antes: "", depois: "" };

    // A legenda só pode ser lida no span do conteúdo da mensagem da Kick.
    // Em divs maiores o texto também contém o nome do usuário e outras mensagens.
    const podeTerLegenda = elemento.tagName === "SPAN" && elemento.classList.contains("font-normal");
    const mensagemComMidia = podeTerLegenda ? separarMensagemComMidia(texto) : null;
    if (mensagemComMidia) {
        legenda = { antes: mensagemComMidia.antes, depois: mensagemComMidia.depois };
        texto = mensagemComMidia.codigo;
    }

    if (!texto) {
        return false;
    }

    if (
        /^(?:KMC_[A-Za-z0-9_.-]+[._](?:IMG|GIF)|KMCIMG_[A-Za-z0-9_.-]+|KMCGIF_TNR_[A-Za-z0-9_.-]+|gph:[A-Za-z0-9_.-]+|tnr:[A-Za-z0-9_.-]+|klp:[A-Za-z0-9_-]+|img:https%3A%2F%2F.+)$/i.test(texto) &&
        codigoAindaEstaSendoDigitadoKMC(texto)
    ) {
        return false;
    }


    // ====================================
    // KMCIMG
    // ====================================

    if (
        /^(?!KMC_KLP[0-9a-z]{1,13}_GIF$)(?:KMC_[A-Za-z0-9_.-]+[._](?:IMG|GIF)|KMCIMG_[A-Za-z0-9_.-]+)$/i.test(texto)
    ) {

        return processarCodigoKMC(
            elemento,
            texto,
            legenda
        );
    }

    const codigoTenorNovo = texto.match(/^KMCGIF_TNR_([A-Za-z0-9_.-]+)$/i);
    if (codigoTenorNovo) {
        const id = codigoTenorNovo[1].replace(/[._]GIF$/i, "");
        const imagem = criarImagemTenor(id);
        renderizarCodigoComMidia(elemento, codificarCodigoTenor(id), imagem.src, imagem, true, legenda);
        return true;
    }


    // ====================================
    // GIPHY
    // ====================================

    const idGiphy = decodificarCodigoGiphy(texto);

    if (idGiphy) {

        const imagem =
            criarImagemGiphy(idGiphy);

        renderizarCodigoComMidia(elemento, texto, imagem.src, imagem, true, legenda);

        return true;
    }

    const urlKlipy = decodificarCodigoKlipy(texto);
    if (urlKlipy) {
        const imagem = criarImagemKlipy(urlKlipy);
        renderizarCodigoComMidia(elemento, texto, urlKlipy, imagem, true, legenda);
        return true;
    }

    const idKlipy = extrairIdCodigoKlipy(texto);
    if (idKlipy) {
        resolverCodigoKlipyKMC(elemento, texto, idKlipy, legenda, "id");
        return true;
    }

    const slugKlipy = extrairSlugCodigoKlipy(texto);
    if (slugKlipy) {
        resolverCodigoKlipyKMC(elemento, texto, slugKlipy, legenda);
        return true;
    }


    // ====================================
    // TENOR
    // ====================================

    const idTenor = decodificarCodigoTenor(texto);
    if (idTenor) {

        const imagem =
            criarImagemTenor(idTenor);

        renderizarCodigoComMidia(elemento, codificarCodigoTenor(idTenor), imagem.src, imagem, true, legenda);

        return true;
    }


    // ====================================
    // COMPATIBILIDADE ANTIGA
    // ====================================

    let resultado;
    resultado =
        texto.match(
            /^img:(https%3A%2F%2F.+)$/i
        );

    if (resultado) {

        const url =
            decodeURIComponent(
                resultado[1]
            );

        if (
            !/^https:\/\/files\.catbox\.moe\//i.test(
                url
            )
        ) {
            return false;
        }

        const imagem =
            criarImagemEnviada(
                url
            );

        renderizarCodigoComMidia(elemento, "img:" + resultado[1], url, imagem, true, legenda);

        return true;
    }

    return false;
}


// ========================================
// PROCURAR DENTRO
// ========================================

function procurarGifDentroElemento(
    elemento
) {

    if (codigoColadoAguardandoEnvioKMC) {
        return;
    }

    // Saída rápida: evita varrer centenas de nós quando o texto não contém nenhum código de mídia.
    if (elemento && elemento.nodeType === 1 && !/KMC_|KMCIMG_|KMCGIF_|gph:|tnr:|klp:|img:https%3A/i.test(elemento.textContent || "")) {
        return;
    }

    if (
        !elemento ||
        elemento.nodeType !== 1
    ) {
        return;
    }

    if (
        elemento.closest &&
        elemento.closest(
            "#kmc-button, #kmc-panel, #kmc-gif-panel"
        )
    ) {
        return;
    }

    if (
        elemento.closest &&
        elemento.closest('[data-kmc-media="true"]')
    ) {
        return;
    }

    if (
        elemento.matches?.(SELETOR_CAMPO_EDITAVEL) ||
        elemento.closest?.(SELETOR_CAMPO_EDITAVEL)
    ) {
        return;
    }

    if (estaDentroDoCampoChatKMC(elemento)) {
        return;
    }

    if (
        processarElementoGif(
            elemento
        )
    ) {
        return;
    }

    const filhos =
        elemento.querySelectorAll
            ? elemento.querySelectorAll(
                "span, p, div"
            )
            : [];

    for (
        const filho of filhos
    ) {

        if (
            processarElementoGif(
                filho
            )
        ) {
            return;
        }
    }

    // Procura também diretamente nos textos.
    // Isso resolve quando a Kick separa o KMCIMG
    // em nós de texto diferentes.

    const walker =
        document.createTreeWalker(
            elemento,
            NodeFilter.SHOW_TEXT
        );

    const textos = [];

    let no;

    while (
        (no = walker.nextNode())
    ) {

        if (
            no.parentElement &&
            no.parentElement.closest &&
            (no.parentElement.closest("#kmc-button, #kmc-panel, #kmc-gif-panel") ||
                no.parentElement.closest('[data-kmc-media="true"]') ||
                no.parentElement.closest(SELETOR_CAMPO_EDITAVEL) ||
                no.parentElement.closest('[data-kmc-chat-input="true"]'))
        ) {
            continue;
        }

        const texto =
            (no.nodeValue || "").trim();

        if (
            /^(?:KMC_[A-Za-z0-9_.-]+[._](?:IMG|GIF)|KMCIMG_[A-Za-z0-9_.-]+|KMCGIF_TNR_[A-Za-z0-9_.-]+|klp:[A-Za-z0-9_-]+)$/i.test(
                texto
            )
        ) {
            if (codigoAindaEstaSendoDigitadoKMC(texto)) {
                continue;
            }
            textos.push(no);
        }
    }

    for (
        const textoNode of textos
    ) {

        const codigo =
            textoNode.nodeValue.trim();

        const urlKlipy = decodificarCodigoKlipy(codigo);
        if (urlKlipy) {
            const pai = textoNode.parentElement;
            if (pai && pai.dataset.kmcProcessed !== "true") {
                renderizarCodigoComMidia(pai, codigo, urlKlipy, criarImagemKlipy(urlKlipy));
            }
            continue;
        }

        const idKlipy = extrairIdCodigoKlipy(codigo);
        if (idKlipy) {
            const pai = textoNode.parentElement;
            if (pai && pai.dataset.kmcProcessed !== "true") resolverCodigoKlipyKMC(pai, codigo, idKlipy, undefined, "id");
            continue;
        }
        const slugKlipy = extrairSlugCodigoKlipy(codigo);
        if (slugKlipy) {
            const pai = textoNode.parentElement;
            if (pai && pai.dataset.kmcProcessed !== "true") {
                resolverCodigoKlipyKMC(pai, codigo, slugKlipy);
            }
            continue;
        }

        if (/^KMCGIF_TNR_/i.test(codigo)) {
            const pai = textoNode.parentElement;
            if (pai && pai.dataset.kmcProcessed !== "true") {
                const id = codigo.replace(/^KMCGIF_TNR_/i, "").replace(/[._]GIF$/i, "");
                const imagem = criarImagemTenor(id);
                renderizarCodigoComMidia(pai, codificarCodigoTenor(id), imagem.src, imagem, true);
            }
            continue;
        }

        const url =
            decodificarCodigoImagem(codigo);

        if (
            !url ||
            !/^https:\/\/files\.catbox\.moe\//i.test(
                url
            )
        ) {
            continue;
        }

        const pai =
            textoNode.parentElement;

        if (
            !pai ||
            pai.dataset.kmcProcessed ===
                "true"
        ) {
            continue;
        }

        renderizarCodigoComMidia(
            pai,
            codigo,
            url,
            criarImagemEnviada(url)
        );
    }
}


// ========================================
// OBSERVADOR
// ========================================

const observadorChat =
    new MutationObserver(
        mutations => {
            if (campoCodigoColadoKMC && !campoCodigoColadoKMC.isConnected) {
                reconciliarProtecaoDeCodigoColadoKMC();
            }

            for (
                const mutation of mutations
            ) {

                const novosNos = mutation.type === "childList"
                    ? [...mutation.addedNodes]
                    : mutation.type === "characterData" && mutation.target.parentElement
                        ? [mutation.target.parentElement]
                        : [];

                for (const noAdicionado of novosNos) {
                    const node = noAdicionado.nodeType === Node.TEXT_NODE
                        ? noAdicionado.parentElement
                        : noAdicionado;

                    if (
                        !node ||
                        node.nodeType !== Node.ELEMENT_NODE
                    ) {
                        continue;
                    }

                    if (
                        node.dataset &&
                        (
                            node.dataset.kmcMedia ===
                                "true" ||
                            node.id ===
                                "kmc-button" ||
                            node.id ===
                                "kmc-panel" ||
                            node.id ===
                                "kmc-gif-panel"
                        )
                    ) {
                        continue;
                    }

                    const liberouAposEnvio = liberarProtecaoAoDetectarMensagemKMC(node);
                    procurarGifDentroElemento(
                        node
                    );

                    if (liberouAposEnvio) {
                        // A Kick pode recriar a linha logo após inseri-la.
                        // Revarre quando o chat terminar essa atualização.
                        agendarBuscaDeMidiaDepoisDoEnvioKMC();
                    }
                }
            }

            agendarPosicionamentoBotaoKMC();
        }
    );

observadorChat.observe(
    document.body,
    {
        childList: true,
        characterData: true,
        subtree: true
    }
);


// ========================================
// BUSCA DE SEGURANÇA
// ========================================

function procurarGifsNoChat() {

    reconciliarProtecaoDeCodigoColadoKMC();
    if (codigoColadoAguardandoEnvioKMC) {
        return;
    }

    marcarCampoChatKMC();

    if (enviandoMensagem) {
        return;
    }

    const elementos =
        document.querySelectorAll(
            "span, p, div"
        );

    for (
        const elemento of elementos
    ) {

        if (
            elemento.dataset &&
            elemento.dataset.kmcMedia ===
                "true"
        ) {
            continue;
        }

        processarElementoGif(
            elemento
        );
    }
}


// ========================================
// LOOP
// ========================================

let ultimaPagina =
    window.location.href;

setInterval(() => {
    if (
        window.location.href !==
        ultimaPagina
    ) {

        ultimaPagina =
            window.location.href;

        verificarPagina();
        reconciliarProtecaoDeCodigoColadoKMC();

        fecharPainelAnimado(painel);
        fecharPainelAnimado(gifPainel);

        imagemSelecionada =
            null;
        limparImagemOriginalSelecionada();
        limparPreviewImagem();

        enviandoMensagem =
            false;

        setTimeout(procurarGifsNoChat, 300);
    }

}, 1500);


// ========================================
// RESIZE
// ========================================

let quadroReposicionamento = 0;
function reposicionarPainelVisivel() {
    if (quadroReposicionamento) return;
    quadroReposicionamento = requestAnimationFrame(() => {
        quadroReposicionamento = 0;
        posicionarBotao();
        if (
            painel.style.display !== "none" ||
            gifPainel.style.display !== "none"
        ) {
            posicionarPainel();
        }
    });
}

window.addEventListener("resize", reposicionarPainelVisivel);
window.addEventListener("scroll", reposicionarPainelVisivel, { capture: true, passive: true });
window.visualViewport?.addEventListener("resize", reposicionarPainelVisivel);
window.visualViewport?.addEventListener("scroll", reposicionarPainelVisivel);

if (typeof ResizeObserver !== "undefined") {
    const observadorTamanhoPainel = new ResizeObserver(reposicionarPainelVisivel);
    observadorTamanhoPainel.observe(painel);
    observadorTamanhoPainel.observe(gifPainel);
}

verificarPagina();
marcarCampoChatKMC();
procurarGifsNoChat();
    }

    function solicitarConsentimentoKMC() {
        const mostrar = () => {
            if (!document.body || document.getElementById("kmc-consent-overlay")) return;
            const estilo = document.createElement("style");
            estilo.textContent = `
                #kmc-consent-overlay { position:fixed!important; inset:0!important; z-index:2147483647!important; display:flex!important; align-items:center!important; justify-content:center!important; padding:18px!important; background:rgba(0,0,0,.78)!important; font-family:Arial,system-ui,sans-serif!important; color:#f4f4f5!important; }
                #kmc-consent-card { box-sizing:border-box!important; width:min(520px,100%)!important; max-height:calc(100vh - 36px)!important; overflow:auto!important; padding:22px!important; border:1px solid #45454b!important; border-radius:14px!important; background:#18181b!important; box-shadow:0 16px 48px rgba(0,0,0,.55)!important; }
                #kmc-consent-card * { box-sizing:border-box!important; }
                #kmc-consent-card h2 { margin:0 0 12px!important; color:#fff!important; font:700 20px/1.3 Arial,system-ui,sans-serif!important; }
                #kmc-consent-card p, #kmc-consent-card li { color:#e4e4e7!important; font:14px/1.5 Arial,system-ui,sans-serif!important; }
                #kmc-consent-card ul { margin:10px 0 14px!important; padding-left:22px!important; }
                #kmc-consent-card label { display:flex!important; align-items:flex-start!important; gap:9px!important; margin:16px 0!important; color:#fff!important; font:14px/1.45 Arial,system-ui,sans-serif!important; }
                #kmc-consent-card input { margin-top:3px!important; accent-color:#53fc18!important; }
                #kmc-consent-card button { min-height:42px!important; padding:9px 14px!important; border:1px solid #555!important; border-radius:8px!important; background:#29292e!important; color:#fff!important; font:600 14px Arial,system-ui,sans-serif!important; cursor:pointer!important; }
                #kmc-consent-card #kmc-consent-accept { border-color:#53fc18!important; background:#53fc18!important; color:#101010!important; }
                #kmc-consent-card button:disabled { opacity:.5!important; cursor:not-allowed!important; }
                #kmc-consent-actions { display:flex!important; justify-content:flex-end!important; gap:10px!important; flex-wrap:wrap!important; }
                #kmc-consent-error { min-height:18px!important; color:#ff9b9b!important; font-size:13px!important; }
            `;
            const overlay = document.createElement("div");
            overlay.id = "kmc-consent-overlay";
            overlay.innerHTML = `
                <section id="kmc-consent-card" role="dialog" aria-modal="true" aria-labelledby="kmc-consent-title" aria-describedby="kmc-consent-description" tabindex="-1">
                    <h2 id="kmc-consent-title">Antes de usar o KICKShot</h2>
                    <p id="kmc-consent-description">Para funcionar, a extensão trata alguns dados desta forma:</p>
                    <ul>
                        <li>Lê localmente o conteúdo da página da Kick para localizar códigos de mídia e exibir as imagens ou GIFs correspondentes.</li>
                        <li>Para buscar GIFs, envia o termo de busca e um identificador aleatório da instalação a um servidor intermediário do KICKShot (hospedado na Cloudflare), que repassa o pedido à KLIPY; ao compartilhar um GIF, envia também o identificador do GIF e o termo da busca pelo mesmo caminho para registrar o compartilhamento. Esse servidor apenas repassa os pedidos e não foi feito para guardar o seu histórico.</li>
                        <li>Envia ao Catbox as imagens que você selecionar para hospedar e compartilhar no chat.</li>
                        <li>Carrega a figurinha do cabeçalho do 7TV e mídias diretamente dos serviços correspondentes.</li>
                    </ul>
                    <p>O KICKShot não envia o histórico do chat a nenhum servidor. Ao marcar a opção e continuar, você concorda com esses usos para fornecer os recursos da extensão.</p>
                    <label><input id="kmc-consent-check" type="checkbox"><span>Li e concordo com o uso de dados descrito acima.</span></label>
                    <p id="kmc-consent-error" role="status" aria-live="polite"></p>
                    <div id="kmc-consent-actions">
                        <button id="kmc-consent-reject" type="button">Agora não</button>
                        <button id="kmc-consent-accept" type="button" disabled>Concordo e continuar</button>
                    </div>
                </section>`;
            document.head.appendChild(estilo);
            document.body.appendChild(overlay);
            const caixa = overlay.querySelector("#kmc-consent-card");
            const checkbox = overlay.querySelector("#kmc-consent-check");
            const aceitar = overlay.querySelector("#kmc-consent-accept");
            const erro = overlay.querySelector("#kmc-consent-error");
            checkbox.addEventListener("change", () => { aceitar.disabled = !checkbox.checked; });
            aceitar.addEventListener("click", () => {
                if (!checkbox.checked || aceitar.disabled) return;
                aceitar.disabled = true;
                chrome.storage.local.set({ [CHAVE_CONSENTIMENTO_KMC]: VERSAO_CONSENTIMENTO_KMC }, () => {
                    if (chrome.runtime.lastError) {
                        erro.textContent = "Não foi possível salvar sua escolha. Recarregue a página e tente novamente.";
                        aceitar.disabled = !checkbox.checked;
                        return;
                    }
                    overlay.remove();
                    estilo.remove();
                    iniciarKICKShot();
                });
            });
            overlay.querySelector("#kmc-consent-reject").addEventListener("click", () => {
                overlay.remove();
                estilo.remove();
                globalThis.__KICKSHOT_CONSENT_UI_STARTED__ = false;
            });
            caixa.focus();
        };
        if (document.body) mostrar();
        else document.addEventListener("DOMContentLoaded", mostrar, { once: true });
    }

    chrome.storage.local.get([CHAVE_CONSENTIMENTO_KMC], dados => {
        if (chrome.runtime.lastError) {
            solicitarConsentimentoKMC();
            return;
        }
        if (dados?.[CHAVE_CONSENTIMENTO_KMC] === VERSAO_CONSENTIMENTO_KMC) iniciarKICKShot();
        else solicitarConsentimentoKMC();
    });
})();
