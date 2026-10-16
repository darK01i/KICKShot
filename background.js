if (typeof importScripts === "function") importScripts("klipy-config.js");
const KICKSHOT_MATCH = "https://kick.com/*";

function kickshotIsKickPage(url) {
    try {
        return new URL(url).origin === "https://kick.com";
    } catch (erro) {
        return false;
    }
}

async function kickshotInject(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ["media-codes.js", "content.js"],
            world: "ISOLATED"
        });
    } catch (erro) {
        console.warn("KICKShot: não foi possível carregar o script na página da Kick:", erro);
    }
}

async function kickshotInjectOpenTabs() {
    try {
        const tabs = await chrome.tabs.query({ url: KICKSHOT_MATCH });
        for (const tab of tabs) {
            if (Number.isInteger(tab.id)) void kickshotInject(tab.id);
        }
    } catch (erro) {
        console.warn("KICKShot: não foi possível procurar abas da Kick:", erro);
    }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && kickshotIsKickPage(tab.url)) {
        void kickshotInject(tabId);
    }
});

chrome.runtime.onInstalled.addListener(() => void kickshotInjectOpenTabs());
chrome.runtime.onStartup.addListener(() => void kickshotInjectOpenTabs());
chrome.runtime.onMessage.addListener((mensagem, remetente, responder) => {
    if (!mensagem || mensagem.tipo !== "KMC_UPLOAD_IMAGEM") {
        return false;
    }

    // Aceita uploads apenas das páginas da Kick onde o content script roda.
    try {
        if (!remetente || !remetente.url || new URL(remetente.url).origin !== "https://kick.com") {
            return false;
        }
    } catch (erro) {
        return false;
    }

    (async () => {
        try {
            const dadosBase64 = mensagem.dadosBase64;
            if (
                typeof dadosBase64 !== "string" ||
                !dadosBase64 ||
                dadosBase64.length % 4 !== 0 ||
                !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(dadosBase64)
            ) {
                throw new Error("Os dados da imagem estão inválidos.");
            }

            const mime = String(mensagem.mime || "").toLowerCase();
            if (!/^image\/[a-z0-9.+-]+$/.test(mime)) {
                throw new Error("O arquivo precisa ser uma imagem válida.");
            }

            const nomeOriginal = String(mensagem.nome || "imagem.png").split(/[\\/]/).pop();
            const nomeSeguro = nomeOriginal.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 120) || "imagem.png";

            const binario = atob(dadosBase64);
            const bytes = new Uint8Array(binario.length);
            for (let i = 0; i < binario.length; i++) {
                bytes[i] = binario.charCodeAt(i);
            }

            const dados = new FormData();
            dados.append("reqtype", "fileupload");
            dados.append("fileToUpload", new Blob([bytes], { type: mime }), nomeSeguro);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);
            let resposta;
            try {
                resposta = await fetch("https://catbox.moe/user/api.php", {
                    method: "POST",
                    body: dados,
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timeout);
            }

            if (!resposta.ok) {
                throw new Error("Catbox respondeu HTTP " + resposta.status + ".");
            }

            const texto = (await resposta.text()).trim();
            let url;
            try {
                url = new URL(texto);
            } catch (erro) {
                throw new Error("Catbox não retornou um link válido.");
            }

            if (
                url.protocol !== "https:" ||
                url.hostname !== "files.catbox.moe" ||
                url.pathname === "/"
            ) {
                throw new Error("Catbox retornou um endereço inesperado.");
            }

            responder({ sucesso: true, url: url.href });
        } catch (erro) {
            console.error("KickMediaChat - erro no upload:", erro);
            responder({
                sucesso: false,
                erro: erro && erro.name === "AbortError"
                    ? "O upload demorou demais. Tente novamente."
                    : (erro && erro.message ? erro.message : String(erro))
            });
        }
    })();

    return true;
});

const KLIPY_APP_KEY = globalThis.KICKSHOT_KLIPY_APP_KEY || "";
const KLIPY_MEDIA_HOSTS = new Set(["static.klipy.com", "static1.klipy.com", "static2.klipy.com"]);

function requisicaoKlipy(url, opcoes = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    return fetch(url, { ...opcoes, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

async function obterIdAnonimoKlipy() {
    return new Promise(resolve => {
        chrome.storage.local.get(["klipyCustomerId"], dados => {
            const existente = dados && dados.klipyCustomerId;
            if (typeof existente === "string" && existente) {
                resolve(existente);
                return;
            }
            const novo = crypto.randomUUID();
            chrome.storage.local.set({ klipyCustomerId: novo }, () => resolve(novo));
        });
    });
}

chrome.runtime.onMessage.addListener((mensagem, remetente, responder) => {
    if (!mensagem || !["KMC_BUSCAR_GIFS", "KMC_KLIPY_COMPARTILHADO", "KMC_KLIPY_RESOLVER"].includes(mensagem.tipo)) return false;

    try {
        if (!remetente?.url || new URL(remetente.url).origin !== "https://kick.com") return false;
    } catch (erro) {
        return false;
    }

    if (!KLIPY_APP_KEY) {
        responder({ sucesso: false, erro: "A busca de GIFs está indisponível no momento." });
        return false;
    }

    (async () => {
        try {
            if (mensagem.tipo === "KMC_KLIPY_RESOLVER") {
                const slug = typeof mensagem.slug === "string" ? mensagem.slug : "";
                if (!/^[A-Za-z0-9_-]{1,160}$/.test(slug)) {
                    responder({ sucesso: false, erro: "O identificador do GIF é inválido." });
                    return;
                }
                const url = new URL(`https://api.klipy.com/api/v1/${encodeURIComponent(KLIPY_APP_KEY)}/gifs/items`);
                url.searchParams.set("slugs", slug);
                const respostaItem = await requisicaoKlipy(url.href, { headers: { Accept: "application/json" } });
                if (!respostaItem.ok) throw new Error("A KLIPY respondeu HTTP " + respostaItem.status + ".");
                const dadosItem = await respostaItem.json();
                const itens = Array.isArray(dadosItem?.data?.data)
                    ? dadosItem.data.data
                    : Array.isArray(dadosItem?.data)
                        ? dadosItem.data
                        : [];
                const item = itens.find(resultado => resultado?.slug === slug);
                const arquivo = item?.file || {};
                const gif = arquivo.hd?.gif || arquivo.md?.gif || arquivo.sm?.gif || item?.media_formats?.gif;
                const urlGif = typeof gif === "string" ? gif : gif?.url;
                let enderecoGif;
                try {
                    enderecoGif = new URL(urlGif);
                } catch (erro) {
                    throw new Error("A KLIPY não encontrou esse GIF.");
                }
                if (enderecoGif.protocol !== "https:" || !KLIPY_MEDIA_HOSTS.has(enderecoGif.hostname)) {
                    throw new Error("A KLIPY retornou um endereço de GIF inválido.");
                }
                responder({ sucesso: true, url: enderecoGif.href });
                return;
            }

            if (mensagem.tipo === "KMC_KLIPY_COMPARTILHADO") {
                const slug = typeof mensagem.slug === "string" ? mensagem.slug : "";
                if (!/^[A-Za-z0-9_-]{1,160}$/.test(slug)) {
                    responder({ sucesso: false, erro: "O identificador do GIF é inválido." });
                    return;
                }
                const customerId = await obterIdAnonimoKlipy();
                const url = `https://api.klipy.com/api/v1/${encodeURIComponent(KLIPY_APP_KEY)}/gifs/share/${encodeURIComponent(slug)}`;
                const respostaCompartilhamento = await requisicaoKlipy(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ customer_id: customerId, q: String(mensagem.consulta || "").slice(0, 80) })
                });
                if (!respostaCompartilhamento.ok) {
                    throw new Error("A KLIPY respondeu HTTP " + respostaCompartilhamento.status + " ao registrar o compartilhamento.");
                }
                const retornoCompartilhamento = await respostaCompartilhamento.json().catch(() => null);
                if (retornoCompartilhamento?.result === false) {
                    throw new Error("A KLIPY não registrou o compartilhamento.");
                }
                responder({ sucesso: true });
                return;
            }

            const consulta = typeof mensagem.consulta === "string" ? mensagem.consulta.trim().slice(0, 80) : "";
            const endpoint = consulta ? "search" : "trending";
            const url = new URL(`https://api.klipy.com/api/v1/${encodeURIComponent(KLIPY_APP_KEY)}/gifs/${endpoint}`);
            const customerId = await obterIdAnonimoKlipy();
            const pagina = Number.isInteger(mensagem.pagina) ? Math.max(1, Math.min(mensagem.pagina, 100)) : 1;
            const porPagina = 50;
            url.searchParams.set("page", String(pagina));
            url.searchParams.set("per_page", String(porPagina));
            url.searchParams.set("customer_id", customerId);
            url.searchParams.set("locale", "pt_BR");
            url.searchParams.set("content_filter", "medium");
            url.searchParams.set("format_filter", "gif");
            if (consulta) url.searchParams.set("q", consulta);

            const resposta = await requisicaoKlipy(url.href, { headers: { Accept: "application/json" } });
            if (!resposta.ok) throw new Error("A KLIPY respondeu HTTP " + resposta.status + ".");
            const dados = await resposta.json();
            if (dados?.result === false) throw new Error("A KLIPY não aceitou a busca.");
            const itens = Array.isArray(dados?.data?.data)
                ? dados.data.data
                : Array.isArray(dados?.data)
                    ? dados.data
                    : [];
            const gifs = itens.slice(0, porPagina).flatMap(item => {
                if (!item) return [];
                const arquivo = item.file || {};
                const gif = arquivo.hd?.gif || arquivo.md?.gif || arquivo.sm?.gif || item.media_formats?.gif;
                const preview = arquivo.sm?.webp || arquivo.sm?.gif || arquivo.md?.webp || gif;
                const urlGif = typeof gif === "string" ? gif : gif?.url;
                const urlPreview = typeof preview === "string" ? preview : preview?.url;
                if (!urlGif || !urlPreview) return [];
                try {
                    const origem = new URL(urlGif);
                    const origemPreview = new URL(urlPreview);
                    if (origem.protocol !== "https:" || !KLIPY_MEDIA_HOSTS.has(origem.hostname) ||
                        origemPreview.protocol !== "https:" || !KLIPY_MEDIA_HOSTS.has(origemPreview.hostname)) return [];
                } catch (erro) {
                    return [];
                }
                if (typeof item.slug !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(item.slug)) return [];
                return [{ url: urlGif, preview: urlPreview, title: String(item.title || "GIF da KLIPY").slice(0, 120), slug: item.slug }];
            });
            responder({ sucesso: true, gifs, temMais: pagina < 100 && itens.length >= porPagina });
        } catch (erro) {
            console.warn("KICKShot: falha ao comunicar com a KLIPY.", erro?.name || "erro");
            responder({ sucesso: false, erro: erro?.name === "AbortError"
                ? "A busca demorou demais. Tente novamente."
                : "Não foi possível buscar GIFs na KLIPY agora. Tente novamente." });
        }
    })();

    return true;
});

chrome.runtime.onMessage.addListener((mensagem, remetente, responder) => {
    if (!mensagem || mensagem.tipo !== "KMC_HASH_MIDIA") return false;

    try {
        if (!remetente?.url || new URL(remetente.url).origin !== "https://kick.com") return false;
    } catch (erro) {
        return false;
    }

    const hostsPermitidos = new Set([
        "files.catbox.moe",
        "media.giphy.com",
        "media1.giphy.com",
        "i.giphy.com",
        "media.tenor.com",
        "c.tenor.com",
        "media1.tenor.com",
        "static.klipy.com",
        "static1.klipy.com",
        "static2.klipy.com"
    ]);
    let url;
    try {
        if (typeof mensagem.url !== "string" || mensagem.url.length > 2048) {
            throw new Error("O endereço da mídia é inválido.");
        }
        url = new URL(mensagem.url);
        if (url.protocol !== "https:" || !hostsPermitidos.has(url.hostname) || url.username || url.password) {
            throw new Error("Este endereço de mídia não pode ser verificado.");
        }
    } catch (erro) {
        responder({ sucesso: false, erro: erro.message || "O endereço da mídia é inválido." });
        return false;
    }

    (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        let reader;
        try {
            const resposta = await fetch(url.href, {
                credentials: "omit",
                redirect: "follow",
                signal: controller.signal
            });
            const urlFinal = new URL(resposta.url);
            if (urlFinal.protocol !== "https:" || !hostsPermitidos.has(urlFinal.hostname)) {
                throw new Error("O servidor redirecionou para um endereço de mídia não permitido.");
            }
            if (!resposta.ok) {
                throw new Error("O servidor da mídia respondeu HTTP " + resposta.status + ".");
            }
            if (!resposta.body) {
                throw new Error("O navegador não conseguiu ler o arquivo da mídia.");
            }

            const tamanhoDeclarado = Number(resposta.headers.get("content-length"));
            const tamanhoMaximo = 25 * 1024 * 1024;
            if (Number.isFinite(tamanhoDeclarado) && tamanhoDeclarado > tamanhoMaximo) {
                throw new Error("O arquivo é grande demais para verificar automaticamente.");
            }

            reader = resposta.body.getReader();
            const partes = [];
            let tamanho = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                tamanho += value.byteLength;
                if (tamanho > tamanhoMaximo) {
                    await reader.cancel();
                    throw new Error("O arquivo é grande demais para verificar automaticamente.");
                }
                partes.push(value);
            }

            const bytes = new Uint8Array(tamanho);
            let deslocamento = 0;
            for (const parte of partes) {
                bytes.set(parte, deslocamento);
                deslocamento += parte.byteLength;
            }
            const digest = await crypto.subtle.digest("SHA-256", bytes);
            const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
            responder({ sucesso: true, hash });
        } catch (erro) {
            console.warn("KICKShot: não foi possível calcular a impressão digital da mídia:", erro);
            responder({
                sucesso: false,
                erro: erro?.name === "AbortError"
                    ? "A verificação da mídia demorou demais."
                    : (erro?.message || String(erro))
            });
        } finally {
            clearTimeout(timeout);
            if (reader) {
                try {
                    reader.releaseLock();
                } catch (erro) {
                    console.warn("KICKShot: não foi possível liberar o leitor da mídia:", erro);
                }
            }
        }
    })();

    return true;
});
