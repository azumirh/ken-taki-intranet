# Ken Taki — rollout de notificações

## Implementado na branch

- Centro de notificações in-app para usuários autenticados.
- Contador de não lidas.
- Marcação individual e em massa como lida.
- Atualização via Supabase Realtime.
- Triggers para assinatura de documento, feedback e pedido de apoio.
- Fila transacional `kt_email_outbox` com status, tentativas, erro e ID do provedor.
- Compatibilidade temporária com perfis técnicos `azumi` e futuros perfis `rh`.
- Sessão autenticada de colaborador preservando a UX nome + filial + 3 últimos dígitos do CPF.
- RLS endurecido validado para colaborador, gestor e RH; produção mantém camada compatível até o rollout do novo frontend.

## Ordem segura de rollout

1. Publicar a branch da aplicação e validar o login autenticado de colaborador no preview/produção controlada.
2. Confirmar leitura/gravação dos históricos privados com `colaborador_id`.
3. Reativar as policies RLS endurecidas para feedbacks, sugestões, apoio, assinaturas e leituras.
4. Confirmar gestor limitado à própria filial e RH com visão autorizada completa.
5. Conectar o worker da fila `kt_email_outbox` ao Resend.
6. Validar entrega, retry e registro de erro do provedor.
7. Somente depois avançar para refino visual e demais itens P1/P2.

## Regras de e-mail

- Assinatura de documento: e-mail para destinatários operacionais elegíveis.
- Feedback relevante: e-mail conforme roteamento e confidencialidade.
- Pedido de apoio: RH por padrão; gestor apenas quando explicitamente associado.
- Leituras comuns não geram e-mail para evitar excesso de notificações.
- Falha do provedor nunca deve desfazer a ação principal do usuário.
