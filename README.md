# Nexora V3

PWA do Nexora com Mentor IA seguro via função serverless da Vercel.

## Rodar localmente
1. Instale Node.js 20+.
2. Rode `npm install`.
3. Crie `.env.local` a partir de `.env.example` e preencha `ANTHROPIC_API_KEY`.
4. Rode `npm run dev`.

## Publicar na Vercel
1. Suba esta pasta para um repositório GitHub.
2. Importe o repositório na Vercel.
3. Em Settings > Environment Variables, adicione `ANTHROPIC_API_KEY`.
4. Opcionalmente adicione `ANTHROPIC_MODEL`.
5. Deploy.

A chave nunca deve ser colocada no React, JSX, HTML ou variáveis `VITE_*`.

## Instalar no celular
Depois do deploy, abra o endereço no Chrome/Edge do celular.
- Android: menu do navegador > Instalar app / Adicionar à tela inicial.
- iPhone: Safari > Compartilhar > Adicionar à Tela de Início.

## Dados
O estado do usuário é salvo localmente no dispositivo via localStorage. Para sincronização entre dispositivos, login, backup e push mesmo com o app fechado, a próxima etapa é adicionar banco/autenticação e armazenamento de assinaturas Web Push.
