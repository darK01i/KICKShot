(function (root, factory) {
    const api = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = api;
    } else {
        root.KICKShotMediaCodes = api;
    }
})(globalThis, function () {
    // Códigos exclusivos do teste: preservam o caminho original do ImgBB.
    function validarImagemImgBB(endereco) {
        return endereco.protocol === "https:" && endereco.hostname === "i.ibb.co" &&
            !endereco.username && !endereco.password && !endereco.port && !endereco.search && !endereco.hash &&
            /^\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(endereco.pathname) && endereco.pathname.length <= 220;
    }
    const EXTENSOES_IBB = Object.freeze({ j: "jpg", e: "jpeg", p: "png", g: "gif", w: "webp", a: "avif", b: "bmp", i: "ico", s: "svg", n: "apng" });
    const TIPOS_IBB = Object.fromEntries(Object.entries(EXTENSOES_IBB).map(([tipo, extensao]) => [extensao, tipo]));
    function codificarImagem(url) {
        try {
            const endereco = new URL(url);
            if (validarImagemImgBB(endereco)) {
                const partes = endereco.pathname.slice(1).split("/");
                const sufixo = /\.gif$/i.test(partes[1]) ? "_GIF" : "_IMG";
                const curto = partes[1].match(/^i\.([a-z]+)$/);
                if (/^[A-Za-z0-9]{1,32}$/.test(partes[0]) && curto && TIPOS_IBB[curto[1]]) {
                    return "KMC_B" + partes[0] + TIPOS_IBB[curto[1]] + sufixo;
                }
                // URLs anteriores ou nomes diferentes: conserva o caminho sem Base64.
                return "KMC_I" + partes[0] + "." + partes[1] + sufixo;
            }
            if (endereco.protocol !== "https:" || endereco.hostname !== "files.catbox.moe") return null;
            const nomeArquivo = decodeURIComponent(endereco.pathname.slice(1));
            if (!/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9]{1,10})?$/.test(nomeArquivo)) return null;
            // Evita que a Kick transforme o tipo da mídia em link.
            const extensaoTipo = /\.gif$/i.test(nomeArquivo) ? "_GIF" : "_IMG";
            return "KMC_" + nomeArquivo.replace(/\./g, "_") + extensaoTipo;
        } catch (erro) {
            console.error("KickMediaChat: não foi possível encurtar o link da imagem:", erro);
            return null;
        }
    }

    function decodificarImagem(codigo) {
        if (typeof codigo !== "string") return null;
        const curtoIBB = codigo.match(/^B([A-Za-z0-9]{1,32})([jepgwabisn])$/);
        if (curtoIBB) return "https://i.ibb.co/" + curtoIBB[1] + "/i." + EXTENSOES_IBB[curtoIBB[2]];
        const caminhoIBB = codigo.match(/^I([A-Za-z0-9_-]+)\.([A-Za-z0-9_.-]+)$/);
        if (caminhoIBB) {
            try {
                const endereco = new URL("https://i.ibb.co/" + caminhoIBB[1] + "/" + caminhoIBB[2]);
                return validarImagemImgBB(endereco) ? endereco.href : null;
            } catch { return null; }
        }
        if (/^IBB_[A-Za-z0-9_-]{1,300}$/.test(codigo)) {
            try {
                let token = codigo.slice(4).replace(/-/g, "+").replace(/_/g, "/");
                token += "=".repeat((4 - token.length % 4) % 4);
                const endereco = new URL("https://i.ibb.co" + atob(token));
                return validarImagemImgBB(endereco) ? endereco.href : null;
            } catch { return null; }
        }

        // Códigos antigos usam Base64URL; códigos curtos novos não devem passar por essa conversão.
        if (/^aHR0cHM[A-Za-z0-9_-]*$/.test(codigo) && codigo.length % 4 !== 1) {
            try {
                let base64 = codigo.replace(/-/g, "+").replace(/_/g, "/");
                base64 += "=".repeat((4 - base64.length % 4) % 4);
                const binario = atob(base64);
                const bytes = Uint8Array.from(binario, caractere => caractere.charCodeAt(0));
                const urlAntiga = new TextDecoder().decode(bytes);
                if (/^https:\/\/files\.catbox\.moe\/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9]{1,10})?$/i.test(urlAntiga)) return urlAntiga;
            } catch (erro) {
                // Tenta reconhecer o formato curto abaixo.
            }
        }

        // Formato curto: identificador e extensão separados por sublinhado.
        const curto = codigo.match(/^([A-Za-z0-9_-]+)_(gif|png|apng|jpe?g|jpe|jfif|webp|avif|bmp|ico|cur|svg|heic|mp4|webm|mov)$/i);
        if (curto) return "https://files.catbox.moe/" + curto[1] + "." + curto[2];

        return null;
    }

    function decodificarCodigoImagem(codigo) {
        if (typeof codigo !== "string" || /^KMC_KLP[0-9a-z]{1,13}_GIF$/i.test(codigo)) return null;
        const payload = codigo
            .replace(/^KMC_/i, "")
            .replace(/[._](?:IMG|GIF)$/i, "")
            .replace(/^KMCIMG_/i, "");
        return decodificarImagem(payload);
    }

    function codificarCodigoGiphy(id) {
        if (typeof id !== "string" || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
        return "gph:" + id + "_GIF";
    }

    function decodificarCodigoGiphy(codigo) {
        if (typeof codigo !== "string") return null;
        const id = codigo
            .replace(/^gph:/i, "")
            .replace(/[._]GIF$/i, "");
        return /^gph:/i.test(codigo) && /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
    }

    function codificarCodigoTenor(id) {
        if (typeof id !== "string" || !/^[A-Za-z0-9_.-]+$/.test(id)) return null;
        return "tnr:" + id + "_GIF";
    }

    function decodificarCodigoTenor(codigo) {
        if (typeof codigo !== "string") return null;
        const id = codigo
            .replace(/^tnr:/i, "")
            .replace(/[._]GIF$/i, "");
        return /^tnr:/i.test(codigo) && /^[A-Za-z0-9_.-]+$/.test(id) ? id : null;
    }

    const HOSTS_KLIPY = new Set(["static.klipy.com", "static1.klipy.com", "static2.klipy.com"]);

    function validarUrlKlipy(url) {
        try {
            const endereco = new URL(url);
            return endereco.protocol === "https:" && HOSTS_KLIPY.has(endereco.hostname.toLowerCase()) && !endereco.username && !endereco.password;
        } catch (erro) {
            return false;
        }
    }

    function codificarCodigoKlipy(url, slug, id) {
        if (typeof url !== "string" || !validarUrlKlipy(url)) return null;
        if ((typeof id === "number" && Number.isSafeInteger(id) && id > 0) || (typeof id === "string" && /^\d{1,16}$/.test(id))) {
            try { const compacto = BigInt(id).toString(36); if (/^[0-9a-z]{1,13}$/.test(compacto)) return "KMC_KLP" + compacto + "_GIF"; } catch (erro) {}
        }
        if (typeof slug === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(slug)) {
            return "klp:" + slug;
        }
        const bytes = new TextEncoder().encode(url);
        let binario = "";
        for (const byte of bytes) binario += String.fromCharCode(byte);
        const token = btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
        return token.length <= 1800 ? "klp:" + token : null;
    }

    function decodificarCodigoKlipy(codigo) {
        if (typeof codigo !== "string" || !/^klp:[A-Za-z0-9_-]+$/i.test(codigo)) return null;
        try {
            let base64 = codigo.slice(4).replace(/-/g, "+").replace(/_/g, "/");
            base64 += "=".repeat((4 - base64.length % 4) % 4);
            const binario = atob(base64);
            const bytes = Uint8Array.from(binario, caractere => caractere.charCodeAt(0));
            const url = new TextDecoder().decode(bytes);
            return validarUrlKlipy(url) ? url : null;
        } catch (erro) {
            return null;
        }
    }

    function extrairSlugCodigoKlipy(codigo) {
        if (typeof codigo !== "string" || !/^klp:[A-Za-z0-9_-]{1,160}$/i.test(codigo)) return null;
        if (decodificarCodigoKlipy(codigo)) return null;
        return codigo.slice(4);
    }

    function extrairIdCodigoKlipy(codigo) {
        const match = typeof codigo === "string" ? codigo.match(/^KMC_KLP([0-9a-z]{1,13})_GIF$/i) : null;
        if (!match) return null;
        try { let id = 0n; for (const c of match[1].toLowerCase()) { const d = parseInt(c, 36); if (!Number.isInteger(d) || d < 0 || d >= 36) return null; id = id * 36n + BigInt(d); } const decimal = id.toString(); return decimal.length <= 16 && id > 0n ? decimal : null; } catch (erro) { return null; }
    }

    function montarMensagemComMidia(texto, codigo) {
        const mensagem = String(texto || "").trim();
        return mensagem ? mensagem + " " + codigo : codigo;
    }

    function separarMensagemComMidia(texto) {
        const mensagem = String(texto || "");
        const prefixosCodigo = /^(?:KMC_|KMCIMG_|KMCGIF_TNR_|gph:|tnr:|klp:|img:https%3A%2F%2F)/i;
        const formatoCodigo = /^(?:KMC_KLP[0-9a-z]{1,13}_GIF|KMC_[A-Za-z0-9_.-]+[._](?:IMG|GIF)|KMCIMG_[A-Za-z0-9_.-]+|KMCGIF_TNR_[A-Za-z0-9_.-]+|gph:[A-Za-z0-9_.-]+|tnr:[A-Za-z0-9_.-]+|klp:[A-Za-z0-9_-]+|img:https%3A%2F%2F[A-Za-z0-9%._~-]+)$/i;
        const tokens = [...mensagem.matchAll(/\S+/g)];
        for (const token of tokens) {
            if (!prefixosCodigo.test(token[0])) continue;
            const codigo = token[0];
            if (!formatoCodigo.test(codigo)) continue;
            return {
                antes: mensagem.slice(0, token.index).trim(),
                codigo,
                depois: mensagem.slice(token.index + token[0].length).trim()
            };
        }
        return null;
    }

    return Object.freeze({ codificarImagem, decodificarImagem, decodificarCodigoImagem, codificarCodigoGiphy, decodificarCodigoGiphy, codificarCodigoTenor, decodificarCodigoTenor, codificarCodigoKlipy, decodificarCodigoKlipy, extrairSlugCodigoKlipy, extrairIdCodigoKlipy, montarMensagemComMidia, separarMensagemComMidia });
});
