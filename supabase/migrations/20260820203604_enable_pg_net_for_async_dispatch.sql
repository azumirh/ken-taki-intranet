-- Ken Taki: enable async HTTP support used by the transactional email dispatcher.
create extension if not exists pg_net with schema public;
