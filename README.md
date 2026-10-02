# Reino Cobblemon — Torneios

Site de torneios do servidor **Reino Cobblemon**
(painéis de madeira com moldura dourada, faixas carmesim, Cinzel + Roboto Condensed).

Baseado no site da Nexus League, com estas adições:

- **Vários torneios** ao mesmo tempo, cada um com dia, horário, tier, regras, vagas, entrada e premiação próprios.
- **Aba completa do administrador** (`/admin/tournaments`) para criar/editar torneios.
- **Integração com o Pokémon Showdown oficial** ([smogon/pokemon-showdown](https://github.com/smogon/pokemon-showdown)):
  o admin escolhe a geração (1 a 9) e a tier. O time completo é validado no servidor com `@pkmn/sim`, incluindo golpes, habilidade, held item, disponibilidade e cláusulas de equipe.
- Os jogadores cadastram até quatro ataques e podem ajustar nível, natureza, EVs, IVs, sexo, shiny e Tera. Os dados são privados e ficam disponíveis na edição e no check-in.
- **Caixas de categorias**: permitir lendários restritos, sub-lendários, míticos, Ultra Beasts e Paradox
  (tags oficiais do Showdown), além de **banimentos extras** e **exceções** por Pokémon, com **prévia ao vivo**.
- **Dois formatos de competição**, usando o mesmo fluxo de inscrições e aprovação:
  - chaveamento por eliminação simples, com byes, disputa de 3º lugar e avanço automático;
  - pontos corridos em um ou dois turnos, com pontuação configurável e classificação automática.
- Sorteio ou ordem de inscrição, lançamento de resultado/placar/horário, W.O., desclassificação e empate quando
  permitido — tudo visível na página pública.
- Regra **Monotype** opcional e configurável; tamanho de time de 1 a 6.

Stack: Next.js 15 · TypeScript · Tailwind CSS 4 · PostgreSQL · Prisma 6 · Zod. Deploy: Cloudflare Workers (OpenNext).

Detalhes de arquitetura, regras e segurança: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

---

## Rodando localmente

```bash
npm install
cp .env.secrets.example .env.secrets   # edite AUTH_SECRET, ADMIN_USERNAME e ADMIN_PASSWORD
docker compose up -d          # PostgreSQL na porta 5433 (já bate com o .env.secrets.example)
npm run db:migrate            # cria as tabelas
npm run db:seed               # cria o admin do .env.secrets
npm run dev
```

- Site: http://localhost:3000
- Painel: http://localhost:3000/admin/login

> **Segredos ficam em `.env.secrets`, nunca em `.env`.** O build da Cloudflare copia os arquivos `.env*` lidos pelo
> Next para dentro do Worker; os scripts `npm run` carregam `.env.secrets` por conta própria e o `cf:deploy` aborta se
> encontrar segredos em `.env`.

> **Banco novo.** Este projeto usa um banco próprio. Não aponte o `DATABASE_URL` para o banco da Nexus League:
> o schema é diferente.

## Criando um torneio

1. Painel → **Torneios** → **Novo torneio**.
2. Preencha nome, dia/horário (horário de Brasília), duração prevista, vagas e valor.
3. Escolha **Chaveamento** ou **Pontos corridos**. Em pontos corridos, configure um ou dois turnos, pontuação por
   vitória/empate/derrota e se empates são permitidos.
4. Em **Tier e regras**, escolha o formato do Showdown. A caixa ao lado mostra as regras e a banlist oficiais e o
   resultado da validação automática do time.
5. Marque as categorias permitidas. Cada caixa mostra quantos Pokémon da categoria o tier realmente libera
   (ex.: "6 de 36 liberados pelo tier"). Para liberar um Pokémon banido pelo tier, adicione-o em **Exceções**
   ou use o formato **Livre**.
   A tier **Cobblemon Free For All** (`cobblemonfreeforall`) não tem banlist nem Species Clause: ao selecioná-la,
   todas as categorias são liberadas e espécies podem se repetir. O comando de conferência é
   validação automática. Restrições extras adicionadas ao torneio ainda valem.
6. Confira a **Prévia das regras** (total permitido, motivos e consulta por nome) e salve.
7. Clique em **Publicar no site**. As inscrições aceitam só Pokémon permitidos; o servidor revalida tudo.

Precedência das regras: **Exceções** → **Banimentos extras** → **Categorias desmarcadas** → **Banlist do tier**.

## Excluir torneio

Na página do torneio (Zona de perigo) ou em **Torneios → Excluir**. Apaga o torneio, as inscrições e as chaves;
exige digitar o nome exato do torneio (conferido também no servidor). O histórico de ações é mantido. Para só tirar
do ar mantendo os dados, use **Cancelar torneio**.

## Banlists do Showdown no painel

**Banlists** mostra os banidos de cada tier (com motivo e busca) e o botão **Verificar banlists no Showdown**, que
compara o commit sincronizado com o master do GitHub oficial e lista as mudanças de tiers/regras ainda não aplicadas.

## Chaves

1. Aprove as inscrições (pago + time conferido no jogo + elegibilidade validada automaticamente).
2. **Chaves** → escolha *Sorteio* ou *Ordem de inscrição* → **Gerar chaves**. As inscrições fecham e o torneio fica
   *Em andamento*.
3. Clique numa partida para lançar vencedor, placar e horário. O vencedor avança sozinho; trocar um resultado apaga os
   resultados seguintes que dependiam dele.
4. Quando todas as partidas terminam, o torneio vira *Finalizado* e o pódio aparece na página pública.

Com as chaves geradas, jogadores delas não podem ser rejeitados, excluídos ou ter o time trocado (resete as chaves antes).

## Pontos corridos

1. Aprove as inscrições pelo mesmo fluxo usado no chaveamento.
2. Em **Tabela**, escolha *Sorteio* ou *Ordem de inscrição* e clique em **Sortear confrontos**.
3. O sistema gera todas as rodadas sem colocar um participante em duas partidas na mesma rodada. Em dois turnos,
   a segunda metade inverte mandante e visitante.
4. Clique numa partida para lançar vencedor, empate, placar, horário, W.O. ou desclassificação.
5. A classificação pública é recalculada por pontos, vitórias, saldo de games, games pró e seed. O torneio termina
   automaticamente quando todos os confrontos forem concluídos.

O sorteio de pontos corridos aceita no máximo 32 participantes para evitar uma tabela impraticável.

## Atualizando os tiers do Showdown

O catálogo e a validação usam as mesmas versões fixadas de `@pkmn/sim` e `@pkmn/mods` (extrações do Pokémon Showdown). O catálogo inclui 151 formatos das gerações 1 a 9, além de Livre e Cobblemon Free For All.

```bash
npm run showdown:sync
npm test
npm run cf:build
```

`showdown:sync` regenera os metadados a partir das dependências instaladas; não atualiza os pacotes. Para atualizar regras, revise e atualize ambas as dependências para a mesma versão, regenere e execute os testes antes de publicar. As três tiers legadas em `src/data/legacy-formats.json` preservam regras históricas do commit `b1156ff`; suas regras auxiliares estão em `src/lib/rules/legacy-*.ts`.

O site valida localmente no servidor; os times não são enviados ao Showdown. O botão de consulta ao GitHub é informativo e não garante equivalência entre o pacote fixado e o master.

### Migração dos times completos

A migração `20261001000000_battle_sets` adiciona `RegistrationPokemon.battleSet` sem apagar inscrições. Execute `npm run db:deploy` no banco de destino antes de publicar o novo Worker. Inscrições antigas mantêm o histórico, mas precisam completar os dados para nova validação ou geração de confrontos. Alterar as regras de um torneio invalida a confirmação de formato anterior. Texto livre em “regras específicas” continua exigindo conferência humana.

## Deploy na Cloudflare (Workers + Hyperdrive)

> Passo a passo completo para instalar a plataforma Reino no domínio existente (incluindo `reinocobblemon.com/torneios`):
> **[docs/INSTALACAO-CLOUDFLARE.md](docs/INSTALACAO-CLOUDFLARE.md)**.

1. Crie um banco PostgreSQL (ex.: Neon) só para a Reino, coloque a conexão em `.env.secrets` (`DATABASE_URL` e
   `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`) e rode `npm run db:deploy`.
2. Crie o Hyperdrive e cole o id em `wrangler.jsonc`:
   ```bash
   npx wrangler hyperdrive create winx-cobblemon-db --connection-string="<DATABASE_URL>" --caching-disabled
   ```
3. Defina o segredo: `npx wrangler secret put AUTH_SECRET`.
4. Publique: `npm run cf:deploy`.
5. Crie o admin no banco de produção: `npm run admin:create -- <usuario> <senha> ["Nome"]`.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` / `npm start` | build e servidor de produção (Node) |
| `npm run typecheck` | checagem de tipos |
| `npm test` | testes do motor de pontos corridos e classificação |
| `npm run db:migrate` / `npm run db:deploy` | migrations (desenvolvimento / produção) |
| `npm run db:seed` | cria o admin do `.env.secrets` |
| `npm run admin:create -- <usuario> <senha> ["Nome"]` | cria admin ou redefine senha |
| `npm run showdown:sync` | atualiza tiers/banlists a partir do Pokémon Showdown |
| `npm run pokemon:sync` | regenera `src/data/pokemon.json` a partir da PokeAPI (rode `showdown:sync` depois) |
| `npm run cf:deploy` | build e deploy na Cloudflare |

## Estrutura

```
prisma/               schema (Tournament, Registration, Match…), migrations e seed
scripts/              sync-showdown.mjs, sync-pokemon.mjs, create-admin.ts
src/data/             pokemon.json (PokeAPI) e showdown.json (tiers/banlists do Showdown)
src/lib/rules/        showdown.ts (formatos) e tournament-rules.ts (legalidade por torneio)
src/lib/bracket.ts    motor das chaves (puro) · bracket-service.ts (orquestra os dois formatos no banco)
src/lib/round-robin.ts motor de pontos corridos e classificação (puro)
src/lib/              auth, validação, inscrições, torneios, auditoria, rate limit
src/components/       UI pública (chaves, pódio, regras) e admin (formulário, chaves, check-in)
src/app/              páginas e rotas de API
```

---

Torneios comunitários. Não afiliado à Nintendo, Game Freak, The Pokémon Company ou Cobblemon.
Tiers e banlists: Pokémon Showdown (MIT). Sprites via [PokeAPI](https://pokeapi.co).
