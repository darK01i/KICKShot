# KICKShot
## Aviso de suporte
**Aviso:** ofereço suporte apenas à versão mais recente da KICKShot. Versões antigas não recebem suporte nem correções. Se tiver algum problema, atualize para a versão mais recente.
## Aviso sobre conteúdo enviado
**Aviso:** Não envie conteúdo ilegal ou criminoso. Você é responsável pelas imagens compartilhadas. A extensão não se responsabiliza pelo conteúdo enviado. As imagens são hospedadas pelo Catbox e estão sujeitas às suas regras.
Extensão independente para compartilhar imagens e GIFs no chat da Kick.
## Chrome e Brave
1. Para Chrome, instale a extensão pela loja oficial [Chrome Web Store](https://chromewebstore.google.com/detail/nlgaiipgkgnpgfodboplfhjlgoohbhne).
2. Para Firefox, instale a extensão pela loja oficial [Firefox Add-ons](https://addons.mozilla.org/pt-BR/firefox/addon/kickshot/).
3. Extraia o ZIP.
4. Abra `brave://extensions` e ative o modo de desenvolvedor.
5. Clique em **Carregar sem compactação** e selecione a pasta extraída que contém `manifest.json`.


## Verificações antes de publicar
O módulo em `shared/media-codes.js` é a fonte comum de regras para imagens, GIPHY e Tenor. Depois de editá-lo, rode `npm run sync:shared` para atualizar as cópias que os navegadores carregam.


Antes de preparar uma versão, rode `npm run preflight`. Esse comando verifica se as cópias continuam iguais, confere a sintaxe dos arquivos e manifestos e executa os testes dos recursos principais.
