# Winx Cobblemon — Arquitetura, regras e segurança

## 1. Visão geral

```
Navegador (público)                                   Navegador (admin)
  /  /<slug>  /<slug>/inscricao  /<slug>/alterar-time      /admin/*  (sessão)
        │                                                     │
        ▼                                                     ▼
  Next.js App Router ─ Server Components (leem o banco no servidor)
        │               Route Handlers (/api/*) ← Zod + regras do torneio
        │
        ├─ src/lib/rules/tournament-rules.ts  legalidade (puro: servidor + prévia do painel)
        ├─ src/lib/rules/showdown.ts          formatos e banlists  ◄── src/data/showdown.json
        ├─ src/lib/pokemon/team-analysis.ts   tamanho, Species Clause, Monotype (puro)
        ├─ src/lib/bracket.ts                 chaves de eliminação simples (puro)
        ├─ src/lib/round-robin.ts             rodadas e classificação de pontos corridos (puro)
        ▼
  Prisma ORM ──► PostgreSQL
```

- `src/data/showdown.json` é gerado por `scripts/sync-formats.ts` com `@pkmn/sim` e `@pkmn/mods` fixados no lockfile. Inclui formatos das gerações 1–9, tipos históricos, Species Clause e banimentos de espécies para o seletor.
- `/api/teams/options` entrega sugestões; `/api/teams/validate` valida uma prévia contra as regras do torneio carregadas do banco. O servidor revalida integralmente em toda criação/edição e antes de gerar confrontos.
- O cliente envia os IDs e sets declarados, nunca flags confiáveis de elegibilidade. Dados completos são guardados em `RegistrationPokemon.battleSet` (JSON), e a leitura privada exige admin ou código de edição.
- O validador clona os sets antes de chamar o Showdown, pois o simulador pode normalizá-los. Os valores declarados ficam preservados. Respostas antigas da prévia não habilitam o envio após uma alteração.
- A lista pública `/api/pokemon?torneio=<slug>` já vem com `banned`/`banReason` calculados para aquele torneio.

## 2. Rotas

| Rota | Acesso |
| --- | --- |
| `/` | público — torneios publicados |
| `/[slug]` | público — regras, premiação, chave ou tabela/classificação (slugs reservados: admin, api, registration, torneios) |
| `/[slug]/inscricao` · `/[slug]/alterar-time` | público |
| `/registration/success` | só quem acabou de se inscrever (cookie assinado) |
| `/admin` · `/admin/tournaments` · `/new` · `/[id]` · `/[id]/bracket` | admin |
| `/admin/registrations?torneio=` · `/[id]` · `/[id]/verify` · `/admin/checkin?torneio=` · `/admin/audit` | admin |
| `GET /api/pokemon?torneio=` | público |
| `POST /api/registrations` · `/edit/lookup` · `/edit` | público (rate limit, CSRF, honeypot) |
| `POST /api/admin/tournaments` · `PUT/PATCH/DELETE /api/admin/tournaments/[id]` | admin |
| `POST /api/admin/tournaments/[id]/bracket` (`generate`, `reset`, `report`, `clear`, `schedule`, `swap`) | admin |
| `GET /api/admin/tournaments/[id]/pokemon` | admin (funciona com rascunhos) |
| `PATCH/DELETE /api/admin/registrations/[id]` | admin |

## 3. Banco (Prisma)

| Modelo | Conteúdo |
| --- | --- |
| `Tournament` | slug, nome, descrição, status (`DRAFT/SCHEDULED/IN_PROGRESS/FINISHED/CANCELLED`), início/fim, formato da competição (`SINGLE_ELIMINATION/ROUND_ROBIN`), turnos e pontuação, `formatId`, `teamSize`, `matchFormat`, 5 flags de categoria, `bannedPokemonIds[]`, `allowedPokemonIds[]`, Monotype (on/mínimo/Coringas), regras em texto, entrada, vagas, inscrições abertas, prêmios, recompensas, disputa de 3º |
| `Registration` | por torneio; nick único **por torneio** (`@@unique([tournamentId, nicknameNormalized])`); código `WINX-0001`; pago / time verificado / **formato verificado** com quem e quando |
| `RegistrationPokemon` | slots, snapshot de nome/tipos; Species Clause no banco |
| `TournamentParticipant` | snapshot dos aprovados que entraram na competição, seed e situação (`ACTIVE/WITHDRAWN/DISQUALIFIED`) |
| `Match` | rodada/posição, jogadores, vencedor, placar numérico e textual, horário, estado e tipo do resultado (`NORMAL/DRAW/WALKOVER/DISQUALIFICATION`) |
| `AuditLog` | admin, torneio, inscrição, ação, descrição, metadata |
| `Admin`, `AdminSession`, `RateLimitHit` | iguais à Nexus League |

## 4. Regras

1. Legalidade de um Pokémon (`banReasonFor`): **exceção** → **banimento extra** → **categoria desmarcada** →
   **banlist do formato**. O formato `free` não tem banlist.
2. Time com exatamente `teamSize` Pokémon, Species Clause por `speciesId`.
3. Monotype (opcional): algum tipo em ≥ `monotypeMinimum` Pokémon e no máximo `maxWildcards` fora dele; tipo
   ambíguo fica marcado para revisão, como na Nexus League.
4. Status `APPROVED` somente com pago + time verificado + formato verificado.
5. Capacidade por torneio com `pg_advisory_xact_lock(727274, hashtext(tournamentId))`; ao lotar, as inscrições fecham.
6. A inscrição relê o torneio dentro do lock: se o admin fechou ou mudou as regras no meio, a inscrição é recusada.
7. Mudar regras não revalida times antigos, mas a página da inscrição no painel avisa se o time viola as regras atuais.
8. **Chaves**: só aprovados; tamanho = próxima potência de 2; seeding padrão (byes para os primeiros); `propagate`
   recalcula todas as rodadas a cada resultado e apaga resultados que deixaram de ser válidos. Final + 3º decididos →
   `FINISHED`. Jogador nas chaves não pode ser rejeitado/excluído/ter o time trocado nem voltar a pendente.
9. **Pontos corridos**: só aprovados; algoritmo circular cria um ou dois turnos sem duplicar adversários nem colocar o
   mesmo participante em duas partidas da rodada. Classificação: pontos → vitórias → saldo de games → games pró → seed.
   Todas as partidas concluídas → `FINISHED`. O sorteio é limitado a 32 participantes.

## 5. Segurança

Mesmo modelo da Nexus League: PBKDF2, sessão com token aleatório (só o SHA-256 no banco), bloqueio por tentativas,
middleware + validação da sessão em cada página/API, CSRF por Origin, Zod em toda entrada, rate limit no banco,
honeypot, CSP restritiva, auditoria na mesma transação. Times continuam secretos: a página pública mostra só nicks
na competição. Cookies: `reino_admin` e `reino_reg`.

### Revisão de segurança (setembro/2026)

| Item | Situação |
| --- | --- |
| Segredos no Worker | **Corrigido.** `.env` era copiado para o bundle pelo OpenNext. Segredos agora em `.env.secrets` (fora do build), `cf:*` com checagem que aborta se houver segredo em `.env*`; `AUTH_SECRET` rotacionado |
| CSRF | Origin/Referer do mesmo host + `Sec-Fetch-Site` ≠ cross-site + corpo obrigatoriamente `application/json`; `X-Forwarded-Host` só é aceito com `TRUST_PROXY=true` |
| Tamanho do corpo | limite de 16 KB conferido em bytes durante a leitura (também sem Content-Length) |
| Rate limit | por IP antes de ler o corpo; o limite global de inscrições só conta envios válidos (lixo não trava todos) |
| Página pública das chaves | ids internos de inscrições/partidas trocados por apelidos (`p1`, `m1`…) |
| Verificação de banlists | compara o commit sincronizado com o master (API de compare do GitHub) e lista commits posteriores em formats-data/formats/rulesets; token opcional `GITHUB_TOKEN` |
| Links externos no painel | commits do GitHub só viram link se forem de github.com/smogon/pokemon-showdown |
| Exclusão de torneio | exige o nome exato (validado no servidor), transação única, auditoria mantida |
| Cobertura de autenticação | todas as rotas `/api/admin/*` (exceto login/logout) exigem sessão; todas as páginas do painel chamam `requireAdminPage` |
| SQL | só consultas parametrizadas do Prisma (único SQL cru: advisory lock com parâmetro) |
| XSS | sem `dangerouslySetInnerHTML`/eval; textos do admin renderizados escapados; CSP + X-Frame-Options + nosniff + HSTS confirmados em produção |
| Dependências | `npm audit`: alertas só em ferramentas de build (PostCSS do Next, deepmerge-ts do CLI do Prisma), sem impacto em runtime; Next na última 15.x |

Recomendações pendentes (dependem de vocês):
- Trocar a senha do banco sempre que ela for exposta (chat, print, arquivo compartilhado) e atualizar `.env.secrets` + `wrangler hyperdrive update`.
- Usar um usuário do Postgres com permissões mínimas em vez de `neondb_owner`.
- Ativar 2FA na conta Cloudflare e no Neon; convidar admins com usernames não óbvios (o bloqueio por 5 erros pode ser provocado por terceiros).
- Se aparecer spam de inscrições falsas, adicionar Cloudflare Turnstile no formulário.

## 6. Decisões e limites

- **Caminho base.** `NEXT_PUBLIC_BASE_PATH` (build) põe o site sob um prefixo, ex.: `/torneios` para rodar em
  `reinocobblemon.com/torneios` via rota do Worker. Links do Next recebem o prefixo sozinhos; `fetch`/`window.location`
  usam `withBase()` (`src/lib/base-path.ts`); o middleware redireciona com `nextUrl.clone()` e os cookies ficam com
  `Path` igual ao prefixo. Testado de ponta a ponta no runtime da Cloudflare (workerd) com `/torneios`.

- **Validação completa:** inclui learnsets, habilidades, itens, geração e regras de equipe (Species Clause, Item Clause, limites de restritos etc.). As mensagens originais de detalhes podem ser em inglês.
- **Livre e Cobblemon Free For All:** não aplicam legalidade de combinações do Showdown. FFA também permite repetir espécies. Restrições extras configuradas no torneio continuam valendo; texto livre não é interpretado automaticamente.
- **Histórico:** sets antigos ficam null; não se inventam ataques. Exige-se completar os dados para validar ou gerar novos confrontos. A migração não altera resultados de competições passadas.
- **Pokémon "Past"** (fora de Scarlet/Violet) são indisponíveis nos formatos S/V; use um formato National Dex para
  liberá-los.
- **Formatos**: eliminação simples ou pontos corridos. Não há dupla eliminação, suíço nem fase de grupos seguida de mata-mata.
- `next dev` troca o Prisma WASM (usado nos Workers) pelo client Node via `next.config.ts`; o build de produção não
  é afetado.

## 7. Verificação realizada

- Typecheck e `next build` sem erros.
- Testes do motor de chaves (5 jogadores → 3 byes, propagação, desfazer semifinal, pódio), do motor de pontos corridos
  (2 a 16 jogadores, confrontos únicos, ida/volta e desempates), legalidade
  (Koraidon: categoria → tier Uber → exceção; formato Livre; National Dex) e fuso horário.
- Ponta a ponta contra PostgreSQL: login; criar torneio (formato inválido 400, slug duplicado 409); página pública;
  legalidade via API; inscrição sem Origin 403, lendário 422, time incompleto 422; 5 inscrições; nick duplicado 409;
  edição pelo jogador; segundo torneio Livre + Monotype 2/3 + restritos + banimento extra com o mesmo nick;
  aprovação completa; gerar chaves (repetir 409; rejeitar/excluir jogador nas chaves 409); inscrição após gerar 409;
  resultados até a final → Finalizado com pódio público; resetar, reabrir, editar; excluir torneio com inscrições 409;
  todas as páginas 200.
- Visual conferido em 1280 px e 390 px (home, torneio com chaves, inscrição, formulário do admin).
