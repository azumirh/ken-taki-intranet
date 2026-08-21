-- Controlled RH employee editing. Important changes still flow through the audit trigger.

create or replace function public.kt_admin_update_colaborador(
  p_colaborador_id text,
  p_nome text,
  p_cpf3 text,
  p_cargo text,
  p_filial text,
  p_nascimento date,
  p_admissao date,
  p_ativo boolean
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text;
begin
  v_role := public.kt_current_profile_type();
  if v_role in ('azumi','rh') then
    if not public.kt_has_admin_permission('colaboradores','edit') then
      raise exception 'Sem permissão para editar colaboradores.';
    end if;
  elsif v_role='gestor' then
    if not exists (
      select 1 from public.kt_colaboradores c
      where c.id=p_colaborador_id and c.filial=public.kt_current_profile_filial()
    ) then
      raise exception 'Gestor só pode editar colaboradores da própria unidade.';
    end if;
    if p_filial <> public.kt_current_profile_filial() then
      raise exception 'Gestor não pode transferir colaborador de unidade.';
    end if;
  else
    raise exception 'Perfil sem permissão.';
  end if;

  if length(trim(coalesce(p_nome,''))) < 2 then raise exception 'Nome inválido.'; end if;
  if p_cpf3 !~ '^\d{3}$' then raise exception 'Informe os 3 últimos dígitos do CPF.'; end if;
  if length(trim(coalesce(p_cargo,''))) < 2 then raise exception 'Cargo inválido.'; end if;
  if p_filial not in ('cristo-rei','champagnat') then raise exception 'Filial inválida.'; end if;

  update public.kt_colaboradores
  set nome=trim(p_nome),
      cpf3=p_cpf3,
      cargo=trim(p_cargo),
      filial=p_filial,
      nascimento=p_nascimento,
      admissao=p_admissao,
      ativo=p_ativo
  where id=p_colaborador_id;
  return found;
end;
$$;

revoke execute on function public.kt_admin_update_colaborador(text,text,text,text,text,date,date,boolean) from public,anon;
grant execute on function public.kt_admin_update_colaborador(text,text,text,text,text,date,date,boolean) to authenticated;
