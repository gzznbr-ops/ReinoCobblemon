import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Todas as páginas são dinâmicas (dados do banco), então não há cache incremental.
export default defineCloudflareConfig({});
