# Política de privacidade da KICKShot

Atualizada em 31 de outubro de 2026. Versão 1.0.17.

A KICKShot é uma extensão independente para compartilhar imagens e GIFs no chat da Kick. Contato: darkartz75@gmail.com.

## Dados usados pelos recursos

- A extensão lê elementos e textos da página para localizar o campo do chat e os códigos de mídia. Essa identificação acontece no navegador. O histórico do chat e os nomes dos participantes não são enviados ao servidor da KICKShot.
- Ao enviar uma imagem do dispositivo, o arquivo escolhido passa pelo servidor intermediário da KICKShot na Cloudflare e é encaminhado ao ImgBB. Se esse serviço atingir o limite, ficar indisponível ou não responder no prazo, a extensão tenta o Catbox automaticamente. Na configuração atual, quando o envio temporário pelo servidor não está disponível, o arquivo é enviado diretamente do navegador ao Catbox comum. O resultado informa o serviço utilizado.
- Ao pesquisar GIFs, o termo de busca, a paginação e um identificador aleatório da instalação passam pelo servidor da KICKShot na Cloudflare e são encaminhados à KLIPY. Ao preparar o compartilhamento de um GIF, seu identificador, o termo da busca e o identificador da instalação também podem ser enviados para registrar o compartilhamento exigido pela integração. Esse identificador distingue a instalação; não contém o nome, o e-mail nem o nome da conta da Kick.
- As mídias são carregadas diretamente de seus serviços de origem, incluindo ImgBB, Catbox, KLIPY, GIPHY e Tenor. A compatibilidade com códigos antigos não significa que a busca de GIFs use todos esses serviços.
- Ao bloquear uma mídia, a extensão pode baixar seu arquivo novamente para calcular uma impressão digital SHA-256 e comparar com bloqueios locais. A lista de bloqueios e os hashes permanecem no navegador.
- A figurinha decorativa vem do CDN do 7TV, e as fontes visuais vêm do Google Fonts. O link de apoio abre o LivePix quando você o escolhe ou escaneia o QR Code. As contribuições são opcionais e não liberam recursos exclusivos.

## Acesso público, retenção e exclusão

Imagens enviadas ficam acessíveis a quem tiver o endereço. Evite imagens privadas, compartilhe somente conteúdo que tenha direito de enviar e considere que os arquivos podem conter metadados. A KICKShot não garante que os provedores removam esses metadados.

O envio ao ImgBB solicita exclusão após 180 segundos, aproximadamente três minutos. A execução depende do serviço e pode atrasar. O Catbox comum não recebe exclusão automática de três minutos: o arquivo pode permanecer público por tempo indeterminado. A extensão só informa exclusão agendada no Catbox quando o servidor confirma esse agendamento; essa modalidade ainda não está ativada na configuração atual.

Apagar uma mensagem remove a visualização da mídia no chat compatível quando a exclusão é recebida; isso não apaga o arquivo no serviço de hospedagem. A expiração na hospedagem também não elimina cópias já carregadas, mantidas no cache ou salvas por terceiros. Links externos e GIFs não recebem o prazo dos uploads ao ImgBB.

Os servidores intermediários da KICKShot encaminham solicitações e não mantêm um armazenamento próprio das imagens nesta configuração. Não foram feitos para guardar um histórico de buscas. Os provedores envolvidos podem manter registros técnicos e aplicar seus próprios prazos de retenção e regras de uso. A exclusão de arquivos não implica restituição de cotas de envio ou tráfego.

## Armazenamento no navegador

O armazenamento da extensão guarda a versão do consentimento e o identificador aleatório da instalação. O armazenamento local do site Kick guarda posições dos painéis, associações de links, códigos e hashes de mídias bloqueadas, além da informação de que um aviso já foi exibido. Esses dados permanecem até serem apagados. Pode ser necessário remover tanto os dados da extensão quanto os dados do site Kick para limpar todos os registros locais.

## Serviços externos e dados da conexão

Conexões com Kick, Cloudflare, ImgBB, Catbox, KLIPY, GIPHY, Tenor, 7TV, Google Fonts e LivePix podem revelar o endereço IP e informações técnicas necessárias à conexão. O arquivo selecionado e os dados descritos acima são compartilhados com os serviços necessários à operação correspondente. Cada provedor aplica sua própria política.

Consulte também as políticas da [Cloudflare](https://www.cloudflare.com/privacypolicy/), [ImgBB](https://imgbb.com/privacy), [Catbox](https://catbox.moe/legal.php), [KLIPY](https://klipy.com/support/privacy-policy), [GIPHY](https://giphy.com/privacy), [Tenor](https://tenor.com/legal-privacy) e [Google](https://policies.google.com/privacy).

## Consentimento e suas escolhas

Antes de iniciar os recursos, a extensão apresenta um aviso sobre o uso dos dados e solicita sua concordância. Você pode recusar, deixar de usar um recurso, desativar ou remover a extensão e apagar os dados locais. No Firefox, as categorias de transmissão também são declaradas ao navegador. Há uma cópia desta política dentro do pacote da extensão.

A KICKShot não vende dados, não inclui analytics próprios e não usa os dados para publicidade personalizada. Seu uso é limitado ao fornecimento e à proteção dos recursos descritos, em conformidade com as restrições de Uso Limitado da Chrome Web Store. A extensão não é afiliada à Kick, às lojas ou aos serviços citados.

## Atualizações e contato

Esta política será revista quando houver mudanças relevantes nos serviços ou no tratamento de dados. Alterações de consentimento são apresentadas novamente aos usuários. Dúvidas podem ser enviadas a darkartz75@gmail.com.
