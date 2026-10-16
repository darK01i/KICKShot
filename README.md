# KICKShot
## Aviso de suporte
**Aviso:** ofereço suporte apenas à versão mais recente da KICKShot. Versões antigas não recebem suporte nem correções. Se tiver algum problema, atualize para a versão mais recente.
## Aviso sobre conteúdo enviado
**Aviso:** Não envie conteúdo ilegal ou criminoso. Você é responsável pelas imagens compartilhadas. A extensão não se responsabiliza pelo conteúdo enviado. As imagens são hospedadas pelo Catbox e estão sujeitas às suas regras.
Extensão independente para compartilhar imagens e GIFs no chat da Kick.

GIFs do GIPHY já compartilhados no chat continuam compatíveis e são exibidos pela extensão. A busca integrada de GIFs usa a KLIPY.
## Instalar
- **Chrome e Brave:** instale pela [Chrome Web Store](https://chromewebstore.google.com/detail/kickshot/nlgaiipgkgnpgfodboplfhjlgoohbhne).
- **Firefox:** instale pela [loja de extensões do Firefox](https://addons.mozilla.org/pt-BR/firefox/addon/kickshot/).
- **Pacotes e código-fonte:** baixe a versão mais recente na página de [Releases do GitHub](https://github.com/darK01i/KICKShot/releases/latest).

## Instalar uma cópia de desenvolvimento no Chrome ou Brave
1. Baixe o ZIP do branch main e extraia.
2. Abra `chrome://extensions` ou `brave://extensions` e ative o modo de desenvolvedor.
3. Clique em **Carregar sem compactação** e selecione a pasta extraída que contém `manifest.json`.

## Verificações antes de publicar
O módulo em `shared/media-codes.js` é a fonte comum de regras para imagens, KLIPY e Tenor. Depois de editá-lo, rode `npm run sync:shared` para atualizar as cópias que os navegadores carregam.

Antes de preparar uma versão, rode `npm run preflight`. Esse comando verifica se as cópias continuam iguais, confere a sintaxe dos arquivos e manifestos e executa os testes dos recursos principais.
