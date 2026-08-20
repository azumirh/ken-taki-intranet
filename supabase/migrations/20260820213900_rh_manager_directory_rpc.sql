-- Ken Taki: RH needs a same-unit manager directory for support routing.
-- kt_perfis remains self-readable under RLS; this RPC exposes only the minimal
-- active-manager fields and only to an authenticated RH profile.

create or replace function public.kt_listar_gestores_para_rh()
returns table (
  id uuid,
  nome text,
  filial text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nome, p.filial
  from public.kt_perfis p
  where p.tipo = 'gestor'
    and coalesce(p.ativo, true)
    and exists (
      select 1
      from public.kt_perfis caller
      where caller.id = auth.uid()
        and caller.tipo in ('azumi', 'rh')
        and coalesce(caller.ativo, true)
    )
  order by p.filial, p.nome;
$$;

revoke execute on function public.kt_listar_gestores_para_rh() from public, anon;
grant execute on function public.kt_listar_gestores_para_rh() to authenticated;
