# Instalação do site de Torneios na Cloudflare do Winx Cobblemon

Este guia coloca o site de torneios Winx no ar **na conta Cloudflare do projeto** e **no domínio existente `reinocobblemon.com`**,
do zero, sem precisar de outra pessoa. Tempo estimado: **40 a 60 minutos** na primeira vez.

Ao final você terá:

- **https://reinocobblemon.com/torneios** → lista de torneios (site público)
- **https://reinocobblemon.com/torneios/admin** → painel da organização
- O restante do `reinocobblemon.com` (loja, wiki etc.) continua exatamente como está.

> Prefere um subdomínio (`https://torneios.reinocobblemon.com`)? Também está coberto — veja a **Opção B** no
> passo 5. As duas opções usam os mesmos arquivos.

---

## Sumário

1. [Como funciona](#1-como-funciona)
2. [O que você precisa](#2-o-que-você-precisa)
3. [Preparar o computador](#3-preparar-o-computador)
4. [Criar o banco de dados (Neon)](#4-criar-o-banco-de-dados-neon)
5. [Escolher o endereço e preencher o `.env.secrets`](#5-escolher-o-endereço-e-preencher-o-envsecrets)
6. [Criar as tabelas do banco](#6-criar-as-tabelas-do-banco)
7. [Entrar na Cloudflare pelo terminal](#7-entrar-na-cloudflare-pelo-terminal)
8. [Criar o Hyperdrive (ponte Cloudflare ↔ banco)](#8-criar-o-hyperdrive-ponte-cloudflare--banco)
9. [Configurar o `wrangler.jsonc` (conta, banco e domínio)](#9-configurar-o-wranglerjsonc-conta-banco-e-domínio)
10. [Publicar](#10-publicar)
11. [Criar o administrador](#11-criar-o-administrador)
12. [Testar tudo](#12-testar-tudo)
13. [Colocar o link no site principal](#13-colocar-o-link-no-site-principal)
14. [Manutenção do dia a dia](#14-manutenção-do-dia-a-dia)
15. [Problemas comuns](#15-problemas-comuns)
16. [Checklist de segurança](#16-checklist-de-segurança)

---

## 1. Como funciona

```
Jogador ──► https://reinocobblemon.com/torneios/...
                │
                ▼
         Cloudflare (a mesma zona que já atende reinocobblemon.com)
                │  rota "reinocobblemon.com/torneios*"
                ▼
         Worker "winx-cobblemon"  ◄── o site de torneios (Next.js)
                │
                ▼
         Hyperdrive (conexão rápida e segura)
                │
                ▼
         PostgreSQL no Neon (torneios, inscrições, chaves, admins)
```

- **Worker**: é o site. Roda na própria Cloudflare, perto dos jogadores.
- **Rota**: diz à Cloudflare "tudo que começar com `/torneios` vai para o Worker". O resto do domínio não é tocado.
- **Hyperdrive**: conecta o Worker ao banco com baixa latência.
- **Neon**: o banco de dados PostgreSQL (tem plano gratuito).

Nada disso exige servidor próprio ou VPS.

---

## 2. O que você precisa

| Item | Detalhe |
| --- | --- |
| Conta Cloudflare **onde está o domínio** `reinocobblemon.com` | Com permissão de **Administrator** (ou, no mínimo, *Workers Scripts: Edit*, *Workers Routes: Edit* e *Hyperdrive: Edit* na zona). |
| Plano **Workers Paid** (US$ 5/mês) — **recomendado** | O plano gratuito limita o processamento por requisição a 10 ms; as páginas do site usam mais que isso e podem dar **erro 1102**. Ative em *Workers & Pages → Plans*. |
| Conta no **Neon** | https://neon.tech (plano gratuito serve para começar). |
| Um computador com **Windows, macOS ou Linux** | Só é usado para publicar; o site não roda nele. |
| **Node.js 22 ou superior** (recomendado: 24 LTS) | https://nodejs.org → botão *LTS*. |
| O arquivo **`winx-cobblemon-site.zip`** | Entregue junto com este tutorial. |

> **Todos os comandos deste guia são para o PowerShell (Windows).** No macOS/Linux use o Terminal; os comandos
> são os mesmos, exceto quando indicado. **Não use o Git Bash** no Windows para estes passos: ele altera caminhos
> como `/torneios` automaticamente.

---

## 3. Preparar o computador

### 3.1 Instalar o Node.js

1. Baixe e instale o Node.js **LTS** em https://nodejs.org (aceite as opções padrão).
2. Feche e abra o PowerShell de novo e confira:

   ```powershell
   node -v
   ```

   Deve mostrar `v22.x` ou maior (ex.: `v24.19.0`).

### 3.2 Extrair os arquivos

1. Extraia `winx-cobblemon-site.zip` para uma pasta **sem espaços e sem acentos** no caminho, por exemplo
   `C:\WinxCobblemon`.
2. Abra o PowerShell **dentro da pasta**: no Explorador de Arquivos, entre em `C:\WinxCobblemon`, clique na barra
   de endereço, digite `powershell` e aperte Enter.
3. Confira que está no lugar certo (deve listar `package.json`, `src`, `prisma`…):

   ```powershell
   dir
   ```

### 3.3 Instalar as dependências

```powershell
npm install
```

Leva de 1 a 3 minutos. Avisos amarelos (`npm warn`) são normais. Só se preocupe se terminar com `npm error`.

---

## 4. Criar o banco de dados (Neon)

1. Entre em https://console.neon.tech e clique em **New Project**.
2. Preencha:
   - **Project name**: `winx-cobblemon`
   - **Postgres version**: a padrão
   - **Region**: a mais próxima do Brasil que aparecer na lista (se houver São Paulo, use-a).
3. Clique em **Create project**.
4. Na tela do projeto, clique em **Connect**.
5. Na janela que abrir:
   - **Desligue** a opção **Connection pooling** (o endereço **não** pode conter `-pooler`).
   - Copie a **connection string**. Ela é parecida com:

     ```
     postgresql://neondb_owner:SENHA@ep-xxxx-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
     ```

6. **Apague o final `&channel_binding=require`** da string (deixe só `?sslmode=require`). Guarde-a num lugar seguro
   por alguns minutos — ela contém a senha do banco.

> ⚠️ Essa string é uma **senha**. Nunca cole em chat, Discord, print ou arquivo que vá para outra pessoa.

---

## 5. Escolher o endereço e preencher o `.env.secrets`

O arquivo `.env.secrets` guarda as senhas **só no seu computador**. Ele é usado para criar as tabelas e publicar;
nunca é enviado para a Cloudflare.

### 5.1 Criar o arquivo

```powershell
Copy-Item .env.secrets.example .env.secrets
notepad .env.secrets
```

### 5.2 Gerar a chave de segurança (`AUTH_SECRET`)

Em outro PowerShell (ou no mesmo, depois de salvar), rode:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Copie o resultado (uma sequência longa de letras e números). **Guarde também** — você vai usar de novo no passo 10.

### 5.3 Escolher o endereço do site

| | **Opção A (recomendada)** | **Opção B** |
| --- | --- | --- |
| Endereço | `https://reinocobblemon.com/torneios` | `https://torneios.reinocobblemon.com` |
| `NEXT_PUBLIC_BASE_PATH` | `"/torneios"` | `""` (vazio) |
| Configuração na Cloudflare | Rota do Worker (passo 9) | Domínio personalizado (passo 9) |

### 5.4 Preencher

Deixe o `.env.secrets` assim (troque os valores em MAIÚSCULAS):

```ini
DATABASE_URL="COLE_AQUI_A_CONNECTION_STRING_DO_NEON"
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="COLE_AQUI_A_MESMA_CONNECTION_STRING"

AUTH_SECRET="COLE_AQUI_A_CHAVE_GERADA_NO_PASSO_5_2"

ADMIN_USERNAME="admin"
ADMIN_PASSWORD="UMA_SENHA_FORTE_COM_PELO_MENOS_12_CARACTERES"

TRUST_PROXY="false"
DISPLAY_TIMEZONE="America/Sao_Paulo"

# Opção A:
NEXT_PUBLIC_BASE_PATH="/torneios"
# Opção B (use esta linha no lugar da de cima):
# NEXT_PUBLIC_BASE_PATH=""
```

Salve e feche o Bloco de Notas.

> **Nunca** coloque essas informações num arquivo chamado `.env`. O processo de publicação copiaria o `.env` para
> dentro do site publicado. O comando de publicação verifica isso e **se recusa a publicar** se encontrar senhas
> em `.env`.

---

## 6. Criar as tabelas do banco

```powershell
npm run db:deploy
```

Resultado esperado no final:

```
All migrations have been successfully applied.
```

Se aparecer erro de conexão, confira a `DATABASE_URL` (sem `-pooler`, sem `&channel_binding=require`, sem espaços
sobrando).

---

## 7. Entrar na Cloudflare pelo terminal

```powershell
npx wrangler login
```

1. O navegador abre a página da Cloudflare.
2. Entre com o login **da conta que tem o domínio `reinocobblemon.com`**.
3. Clique em **Allow** para autorizar o Wrangler (ferramenta oficial da Cloudflare).
4. Volte ao PowerShell e confira a conta:

   ```powershell
   npx wrangler whoami
   ```

   Anote o **Account ID** da conta onde está o domínio (você vai usar no passo 9).

> Se o seu login tiver acesso a **mais de uma conta**, o `whoami` lista todas. Use o Account ID da conta que
> aparece no painel da Cloudflare junto com `reinocobblemon.com`.

---

## 8. Criar o Hyperdrive (ponte Cloudflare ↔ banco)

Troque `COLE_AQUI` pela connection string do Neon (a mesma do `.env.secrets`) e rode:

```powershell
npx wrangler hyperdrive create winx-cobblemon-db --connection-string="COLE_AQUI" --caching-disabled
```

- Se perguntar *"Would you like Wrangler to add it on your behalf?"*, responda **n** (vamos colar manualmente).
- Resultado esperado:

  ```
  ✅ Created new Hyperdrive PostgreSQL config: 0123456789abcdef0123456789abcdef
  ```

Copie esse **id** (32 caracteres).

> `--caching-disabled` é importante: sem ele, vagas e resultados das chaves poderiam aparecer desatualizados.

---

## 9. Configurar o `wrangler.jsonc` (conta, banco e domínio)

Abra o arquivo:

```powershell
notepad wrangler.jsonc
```

Faça três ajustes:

### 9.1 Conta

Troque `COLE_AQUI_O_ACCOUNT_ID` pelo Account ID anotado no passo 7.

### 9.2 Banco

Troque `COLE_AQUI_O_ID_DO_HYPERDRIVE` pelo id do passo 8.

### 9.3 Domínio

Deixe **apenas um** dos blocos abaixo ativo (sem `//` na frente), conforme a opção escolhida no passo 5.

**Opção A — `reinocobblemon.com/torneios`:**

```jsonc
  "routes": [
    { "pattern": "reinocobblemon.com/torneios*", "zone_name": "reinocobblemon.com" }
  ],
```

> Se o site principal também abre em `www.reinocobblemon.com`, adicione uma segunda linha:
> `{ "pattern": "www.reinocobblemon.com/torneios*", "zone_name": "reinocobblemon.com" }` — e use sempre o mesmo
> endereço (com ou sem `www`) no link do menu.

**Opção B — `torneios.reinocobblemon.com`:**

```jsonc
  "routes": [
    { "pattern": "torneios.reinocobblemon.com", "custom_domain": true }
  ],
```

> Na Opção B **não** crie o registro DNS `torneios` manualmente: a Cloudflare cria sozinha ao publicar. Se já existir
> um registro `torneios` no DNS, apague-o antes.

O arquivo final fica parecido com isto (Opção A):

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "winx-cobblemon",
  "account_id": "a1b2c3d4e5f6...",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-09-01",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "0123456789abcdef0123456789abcdef" }],
  "routes": [
    { "pattern": "reinocobblemon.com/torneios*", "zone_name": "reinocobblemon.com" }
  ],
  "workers_dev": false,
  "vars": { "TRUST_PROXY": "cloudflare", "DISPLAY_TIMEZONE": "America/Sao_Paulo" },
  "observability": { "enabled": true }
}
```

Salve e feche.

---

## 10. Publicar

### 10.1 Publicar o site

```powershell
npm run cf:deploy
```

Leva de 2 a 5 minutos. No Windows aparece o aviso *"OpenNext may function on Windows, it could encounter
unpredictable failures"* — é normal. Na Opção A também aparece *"The following routes will attempt to serve Assets on a
configured path: reinocobblemon.com/torneios*"* — também é normal (os arquivos do site já ficam dentro de `/torneios`).
O final esperado:

```
Uploaded winx-cobblemon
Deployed winx-cobblemon triggers
  reinocobblemon.com/torneios*
```

### 10.2 Enviar a chave de segurança para a Cloudflare

```powershell
npx wrangler secret put AUTH_SECRET
```

Quando pedir o valor, **cole a mesma chave** do `AUTH_SECRET` do `.env.secrets` e aperte Enter.

> O valor não aparece enquanto você cola — é normal. Resultado: `✨ Success! Uploaded secret AUTH_SECRET`.

### 10.3 (Opcional) Token do GitHub para o botão "Verificar banlists"

O botão consulta o GitHub do Pokémon Showdown. Sem token, o GitHub permite ~60 consultas por hora e às vezes
responde "limite atingido". Para evitar:

1. Em https://github.com/settings/personal-access-tokens crie um **Fine-grained token** com acesso somente a
   *Public repositories* e **nenhuma permissão extra**.
2. Rode e cole o token:

   ```powershell
   npx wrangler secret put GITHUB_TOKEN
   ```

---

## 11. Criar o administrador

```powershell
npm run admin:create -- admin "SUA_SENHA_FORTE" "Nome que aparece no painel"
```

Resultado: `✔ Admin "admin" criado.`

- Para **outro admin**: repita com outro usuário (ex.: `npm run admin:create -- joao "OutraSenha#2026" "João"`).
- Para **trocar a senha** de alguém: rode o mesmo comando com o usuário existente (as sessões abertas dele são encerradas).
- Use usuários **não óbvios** e senhas com 12+ caracteres. Após 5 senhas erradas a conta fica bloqueada por 15 minutos.

---

## 12. Testar tudo

Espere 1 minuto após publicar e siga a lista:

| # | Teste | Esperado |
| --- | --- | --- |
| 1 | Abrir `https://reinocobblemon.com/torneios` | Página "Torneios" com o visual Winx |
| 2 | Abrir `https://reinocobblemon.com` | Site principal **igual** a antes |
| 3 | Abrir `https://reinocobblemon.com/torneios/admin` | Vai para a tela de login |
| 4 | Entrar com o admin do passo 11 | Dashboard do painel |
| 5 | **Torneios → Novo torneio**, criar um torneio de teste (Gen 9 OU) e clicar **Publicar no site** | Aparece em `/torneios` |
| 6 | Abrir o torneio no celular e fazer uma inscrição com seu nick | Tela "Inscrição recebida!" com código `WINX-0001` |
| 7 | No painel: **Banlists → Verificar banlists no Showdown** | Mostra o commit em uso e se há mudanças |
| 8 | No painel: excluir o torneio de teste (Zona de perigo → digitar o nome) | Torneio some do site |

Se algo falhar, veja a seção [Problemas comuns](#15-problemas-comuns).

---

## 13. Colocar o link no site principal

No painel/tema do site principal (loja), adicione um item de menu:

- **Texto**: `Torneios`
- **Link**: `https://reinocobblemon.com/torneios` (Opção A) ou `https://torneios.reinocobblemon.com` (Opção B)

Os links diretos de cada torneio seguem o formato `https://reinocobblemon.com/torneios/<endereço-do-torneio>`
(o "endereço público" definido ao criar o torneio). Esses são os links para divulgar no Discord.

---

## 14. Manutenção do dia a dia

Tudo abaixo é feito **na pasta do site** (`C:\WinxCobblemon`), no PowerShell.

### 14.1 Atualizar as banlists do Pokémon Showdown

As tiers do Showdown mudam (normalmente todo início de mês). O painel avisa em **Banlists → Verificar banlists**.
Para aplicar:

```powershell
npm run showdown:sync
npm run cf:deploy
```

O primeiro comando recalcula o catálogo a partir das versões instaladas de `@pkmn/sim` e `@pkmn/mods`. Para regras novas, atualize e fixe ambas as dependências, regenere e rode `npm test`. O segundo comando publica. A migração `20261001000000_battle_sets` deve ser aplicada com `npm run db:deploy` antes da primeira publicação desta versão.

### 14.2 Ver erros em tempo real

```powershell
npx wrangler tail winx-cobblemon
```

Deixe aberto e reproduza o problema no navegador. `Ctrl + C` para sair.

### 14.3 Atualizar o site com uma nova versão dos arquivos

1. **Guarde** `.env.secrets` e `wrangler.jsonc` da pasta atual.
2. Extraia os arquivos novos por cima (ou numa pasta nova) e devolva `.env.secrets` e `wrangler.jsonc`.
3. Rode:

   ```powershell
   npm install
   npm run db:deploy
   npm run cf:deploy
   ```

   `db:deploy` só altera o banco se a nova versão trouxer mudanças de estrutura; nos outros casos não faz nada.

### 14.4 Backup do banco

O Neon mantém histórico automático (restauração para um horário anterior; o período depende do plano). Antes de
atualizações grandes, crie uma cópia instantânea: **Neon → Branches → Create branch** a partir de `main`.

### 14.5 Trocar a senha do banco

1. **Neon → Roles → neondb_owner → Reset password** e copie a nova connection string.
2. Atualize `DATABASE_URL` e `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` no `.env.secrets`.
3. Atualize o Hyperdrive (troque `ID` e `NOVA_SENHA`):

   ```powershell
   npx wrangler hyperdrive update ID --origin-password NOVA_SENHA
   ```

### 14.6 Tirar o site do ar temporariamente

Em **Cloudflare → Workers & Pages → winx-cobblemon → Settings → Domains & Routes**, remova a rota. Para voltar,
rode `npm run cf:deploy` de novo.

---

## 15. Problemas comuns

| Sintoma | Causa provável | Como resolver |
| --- | --- | --- |
| **Erro 1102** (*Worker exceeded resource limits*) | Plano gratuito do Workers | Ative o **Workers Paid** (passo 2). |
| `/torneios` abre a página 404 **do site principal** | Rota não criada ou padrão errado | Confira `routes` no `wrangler.jsonc` (`reinocobblemon.com/torneios*`) e rode `npm run cf:deploy`. Veja em *Workers & Pages → winx-cobblemon → Domains & Routes*. |
| Página abre **sem estilo** (texto cru) ou 404 em `/torneios/_next/...` | Publicado sem `NEXT_PUBLIC_BASE_PATH="/torneios"` | Corrija o `.env.secrets` e rode `npm run cf:deploy` de novo. |
| `/torneios` abre, mas os links vão para `reinocobblemon.com/...` sem `/torneios` | Mesmo problema acima | Idem. |
| Login volta sempre para a tela de login | Site acessado por `http://` ou `AUTH_SECRET` ausente | Use `https://`; confira o passo 10.2. |
| Erro 500 em todas as páginas | Hyperdrive com id errado ou banco inacessível | Confira o id no `wrangler.jsonc`; teste `npm run db:deploy`; veja `npx wrangler tail winx-cobblemon`. |
| `✖ Segredos em .env seriam embutidos no Worker` | Existe um arquivo `.env` com senhas | Mova o conteúdo para `.env.secrets` e apague o `.env`. |
| `Authentication error [code: 10000]` ao publicar | Login do Wrangler em outra conta ou sem permissão | `npx wrangler logout`, `npx wrangler login` com a conta certa, confira `account_id`. |
| `Could not find zone for reinocobblemon.com` | O domínio está em outra conta | Use o `account_id` da conta que tem o domínio. |
| Inscrição dá erro **403** / tela de desafio da Cloudflare | Bot Fight Mode ou regra do WAF bloqueando `POST` | Em *Security → WAF*, crie uma exceção (*Skip*) para `URI Path starts with /torneios/api/`. |
| "Limite de consultas ao GitHub atingido" no botão de banlists | Muitas verificações sem token | Configure o `GITHUB_TOKEN` (passo 10.3) ou tente depois. |
| `npm run showdown:sync` falha com *"We require Node.js version 22"* | Node antigo | Instale o Node 24 LTS. |
| Caminho vira `C:/Program Files/Git/torneios` | Comandos rodados no **Git Bash** | Use o **PowerShell**. |

---

## 16. Checklist de segurança

- [ ] `.env.secrets` **nunca** é enviado a ninguém nem colocado em repositório/ZIP.
- [ ] Senha forte e usuário não óbvio para cada admin; um login por pessoa (o histórico registra quem fez cada ação).
- [ ] **Autenticação em dois fatores** ativa na Cloudflare e no Neon.
- [ ] "Always Use HTTPS" ativo na zona (*SSL/TLS → Edge Certificates*).
- [ ] Remover admins que saírem da equipe: `npm run admin:create -- usuario "senha-aleatoria-longa"` troca a senha e derruba as sessões.
- [ ] Se a connection string do banco vazar: troque a senha (passo 14.5) imediatamente.
- [ ] Se o `AUTH_SECRET` vazar: gere outro (passo 5.2), atualize o `.env.secrets` e rode `npx wrangler secret put AUTH_SECRET`
      (códigos de edição de times já emitidos deixam de valer; os jogadores pedem novos à organização).

---

### Referência rápida de comandos

| Comando | Para quê |
| --- | --- |
| `npm install` | Instalar dependências (uma vez, e após atualizar os arquivos) |
| `npm run db:deploy` | Criar/atualizar tabelas do banco |
| `npx wrangler login` / `npx wrangler whoami` | Entrar na Cloudflare / ver a conta |
| `npm run cf:deploy` | Publicar o site |
| `npx wrangler secret put AUTH_SECRET` | Enviar a chave de segurança |
| `npm run admin:create -- usuario "senha" "Nome"` | Criar admin ou trocar senha |
| `npm run showdown:sync` | Atualizar banlists do Showdown (depois `cf:deploy`) |
| `npx wrangler tail winx-cobblemon` | Ver erros ao vivo |

Mais detalhes técnicos: `README.md` e `docs/ARQUITETURA.md`.
