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

## Atualização de regras pelo painel

O painel compara as versões estáveis publicadas de `@pkmn/sim` e `@pkmn/mods`.
Só oferece atualização quando ambos têm a mesma versão, superior à instalada.
Commits recentes do Showdown podem ainda não estar presentes nesses pacotes.

Ao clicar em **Aplicar atualizações?**, o servidor autentica o administrador,
valida a origem, consulta novamente as versões, registra a aprovação no banco
e chama um Deploy Hook da branch `main`. Nenhum segredo chega ao navegador.

Pré-requisitos de configuração (uma vez):

1. Aplicar a migração `20261002210000_rules_release`.
2. Publicar as rotas de coordenação antes de ativar o novo comando de CI.
3. Criar o Deploy Hook `regras-admin` para `main` no Worker `reino-cobblemon`.
4. Salvar a URL como secret do Worker `RULES_DEPLOY_HOOK`.
5. Gerar uma chave aleatória de pelo menos 32 caracteres e salvá-la como
   `RULES_BUILD_SECRET`, tanto nos secrets do Worker quanto nos secrets de
   **Builds**. Não usar prefixo `NEXT_PUBLIC_` nem copiar para `.env` no build.

O builder adquire um bloqueio exclusivo, lê a versão aprovada, instala somente
os dois pacotes fixados nessa versão, gera o catálogo, roda os testes e compila.
Antes do deploy, confirma que a aprovação ainda é a mesma. A nova versão só é
marcada como publicada quando o Worker responde com o identificador desse build.
O segredo de coordenação é removido do ambiente dos processos de compilação.

Novos commits também usam a versão aprovada persistida no banco; portanto, um
`package.json` antigo no Git não reverte automaticamente as regras aprovadas.
O diretório de build é temporário: o processo não grava atualizações no Git.

## Torneios e recuperação de falhas

Não é possível iniciar uma atualização enquanto existir torneio em DRAFT,
SCHEDULED ou IN_PROGRESS. A criação/alteração e ações de confrontos compartilham
o mesmo bloqueio transacional da aprovação, impedindo corridas entre operações.
Durante uma atualização pendente, novas alterações de torneios ficam bloqueadas.
Os torneios finalizados continuam no histórico; não há simuladores antigos
armazenados por torneio.

Falhas antes de iniciar o deploy liberam o bloqueio do builder, mantendo a
aprovação pendente para nova tentativa no painel. A versão anterior permanece
em produção. Não há atualização por relógio, timeout ou troca automática de versão.

Se o processo for morto ou o deploy tiver resposta ambígua, o bloqueio não expira:
expirar poderia permitir que um build atrasado trocasse regras após outro torneio
começar. O operador deve conferir os builds na Cloudflare. Se a publicação já
ocorreu, abrir o painel confirma a versão e libera o bloqueio. Caso contrário,
cancele/aguarde todos os builds envolvidos e, **somente depois de confirmar que
nenhum deles poderá publicar**, limpe `buildId` e `publishing` do registro
`RulesRelease` (id 1) para tentar novamente. A versão aprovada permanece.

Rollbacks e deploys manuais precisam considerar a versão persistida em
`RulesRelease`; não executar `cf:deploy` com catálogo local antigo depois de
ativar atualizações. Preserve as versões anteriores da Cloudflare para recuperação.
