# Ken Taki Intranet

Aplicação interna do Ken Taki para colaboradores, gestores e RH.

## Fluxo de desenvolvimento

Mudanças de produção devem passar por branch de trabalho, preview da Vercel, revisão em pull request e validação antes de merge na `main`.

A branch `feat/production-hardening` concentra a atual revisão de identidade, notificações, segurança operacional e preparação de e-mails transacionais.

## Integrações principais

- Supabase: autenticação, banco, storage e realtime.
- Vercel: build, previews e produção.
- Resend: e-mails transacionais do servidor.

## Segurança

Não colocar `SUPABASE_SERVICE_ROLE_KEY` ou `RESEND_API_KEY` em código cliente. As chaves server-only devem permanecer em variáveis de ambiente do ambiente de execução.
