# Cloudflare Builds

Repositório privado: `gzznbr-ops/ReinoCobblemon`.
Worker existente: `reino-cobblemon`.

- Branch de produção: `main`
- Diretório raiz: `/`
- Build command: `npm run cf:ci-build`
- Deploy command: `npm run cf:ci-deploy`
- Versão de Node: 22 ou superior (preferir 22)

O Cloudflare instala as dependências antes do build. O comando de build roda
os testes e gera o pacote OpenNext. Uma falha interrompe a publicação.
O comando de deploy usa o token do Workers Builds configurado no painel.

Não copiar `.env.secrets` para o repositório ou criar arquivos `.env` no build.
O banco de produção e `AUTH_SECRET` permanecem nos bindings/secrets do Worker.
Estes comandos não executam migrações nem seed. Migrações devem ser revisadas
e aplicadas separadamente quando necessárias.

Esta conexão publica commits; sozinha, ainda não implementa o botão de
atualização das regras no painel. A implementação desse fluxo está pendente.
