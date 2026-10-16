# KICKShot
## Aviso de suporte
**Aviso:** ofereço suporte apenas à versão mais recente da KICKShot. Versões antigas não recebem suporte nem correções. Se tiver algum problema, atualize para a versão mais recente.
## Aviso sobre conteúdo enviado
**Aviso:** Não envie conteúdo ilegal ou criminoso. Você é responsável pelas imagens compartilhadas. A extensão não se responsabiliza pelo conteúdo enviado. As imagens são hospedadas pelo Catbox e estão sujeitas às suas regras.
Extensão independente para compartilhar imagens e GIFs no chat da Kick.
## Chrome, Firefox e Github
1. Para Chrome, instale a extensão pela loja oficial [Chrome Web Store](https://chromewebstore.google.com/detail/nlgaiipgkgnpgfodboplfhjlgoohbhne).
2. Para Firefox, instale a extensão pela loja oficial [Firefox Add-ons](https://addons.mozilla.org/pt-BR/firefox/addon/kickshot/).
3. No GitHub instale a última versão (https://github.com/darK01i/KICKShot/releases/tag/v1.0.9) (recomendado baixar nas lojas)
4. Caso instale pelo GitHub, baixe o ZIP desta release, extraia e carregue a pasta que contém manifest.json na página de extensões, com o modo de desenvolvedor ativado.


## Verificações antes de publicar
O módulo em `shared/media-codes.js` é a fonte comum de regras para imagens, GIPHY e Tenor. Depois de editá-lo, rode `npm run sync:shared` para atualizar as cópias que os navegadores carregam.


Antes de preparar uma versão, rode `npm run preflight`. Esse comando verifica se as cópias continuam iguais, confere a sintaxe dos arquivos e manifestos e executa os testes dos recursos principais.
