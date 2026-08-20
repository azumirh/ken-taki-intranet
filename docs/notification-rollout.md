# Ken Taki — rollout de notificações

## Implementado na branch

- Centro de notificações in-app para usuários autenticados.
- Contador de não lidas.
- Marcação individual e em massa como lida.
- Atualização via Supabase Realtime.
- Migration versionada com triggers para:
  - assinatura de documento;
  - feedback;
  - pedido de apoio.
- Compatibilidade temporária com perfis `azumi` e futuros perfis `rh`.

## Antes do merge para produção

1. Aplicar a migration em ambiente seguro/branch do Supabase.
2. Testar um gestor de cada filial.
3. Testar o perfil RH.
4. Confirmar que feedback anônimo não revela autor ao gestor.
5. Confirmar que pedido de apoio sem `gestor_id` vai apenas para RH.
6. Confirmar que pedido com `gestor_id` também notifica o gestor indicado.
7. Validar Realtime de `app_notifications`.
8. Validar links de ação das notificações.

## E-mail transacional

O e-mail de primeiro acesso já usa Resend e passou a registrar falhas nos logs. O próximo passo é conectar os mesmos eventos de negócio a um dispatcher transacional com histórico de entrega, sem bloquear a gravação do evento principal caso o provedor de e-mail esteja indisponível.
