-- Safe bulk import for RH spreadsheets. Importing records never creates Auth users or sends access emails.

create or replace function public.kt_admin_import_colaboradores(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_item jsonb;
  v_ord bigint;
  v_row integer;
  v_nome text;
  v_cpf3 text;
  v_cargo text;
  v_filial text;
  v_nascimento text;
  v_admissao text;
  v_ativo boolean;
  v_key text;
  v_seen text[] := '{}';
  v_existing_id text;
  v_matches integer;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_errors jsonb := '[]'::jsonb;
begin
  if public.kt_current_profile_type() not in ('azumi','rh')
     or not public.kt_has_admin_permission('colaboradores','edit') then
    raise exception 'Sem permissão para importar colaboradores.';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Arquivo de importação inválido.';
  end if;

  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'A importação aceita no máximo 2.000 linhas por vez.';
  end if;

  for v_item, v_ord in
    select value, ordinality from jsonb_array_elements(p_rows) with ordinality
  loop
    v_row := coalesce(nullif(v_item->>'row','')::integer, (v_ord + 1)::integer);
    v_nome := trim(coalesce(v_item->>'nome',''));
    v_cpf3 := regexp_replace(coalesce(v_item->>'cpf3',''), '\D', '', 'g');
    v_cargo := trim(coalesce(v_item->>'cargo',''));
    v_filial := coalesce(v_item->>'filial','');
    v_nascimento := nullif(v_item->>'nascimento','');
    v_admissao := nullif(v_item->>'admissao','');
    v_ativo := coalesce((v_item->>'ativo')::boolean, true);

    if length(v_nome) < 2 then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row',v_row,'message','Nome ausente ou inválido'));
      continue;
    end if;
    if v_cpf3 !~ '^\d{3}$' then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row',v_row,'message','CPF precisa ter exatamente 3 dígitos finais'));
      continue;
    end if;
    if length(v_cargo) < 2 then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row',v_row,'message','Cargo ausente ou inválido'));
      continue;
    end if;
    if v_filial not in ('cristo-rei','champagnat') then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row',v_row,'message','Unidade inválida'));
      continue;
    end if;
    if v_nascimento is not null and v_nascimento !~ '^\d{4}-\d{2}-\d{2}$' then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row',v_row,'message','Data de nascimento inválida'));
      continue;
    end if;
    if v_admissao is not null and v_admissao !~ '^\d{4}-\d{2}-\d{2}$' then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row',v_row,'message','Data de admissão inválida'));
      continue;
    end if;

    v_key := lower(v_nome) || '|' || v_cpf3 || '|' || v_filial;
    if v_key = any(v_seen) then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row',v_row,'message','Cadastro duplicado dentro do arquivo'));
      continue;
    end if;
    v_seen := array_append(v_seen,v_key);

    select count(*)::integer, min(id)
      into v_matches, v_existing_id
    from public.kt_colaboradores
    where lower(trim(nome)) = lower(v_nome)
      and cpf3 = v_cpf3
      and filial = v_filial;

    if v_matches > 1 then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row',v_row,'message','Há mais de um cadastro correspondente no banco; revise manualmente'));
      continue;
    end if;

    if v_matches = 1 then
      update public.kt_colaboradores
      set nome = v_nome,
          cpf3 = v_cpf3,
          cargo = v_cargo,
          filial = v_filial,
          nascimento = coalesce(v_nascimento,nascimento),
          admissao = coalesce(v_admissao,admissao),
          ativo = v_ativo,
          updated_at = now()
      where id = v_existing_id;
      v_updated := v_updated + 1;
    else
      insert into public.kt_colaboradores(
        id,nome,cpf3,cargo,filial,nascimento,admissao,ativo,updated_at
      ) values (
        'imp_' || replace(gen_random_uuid()::text,'-',''),
        v_nome,v_cpf3,v_cargo,v_filial,v_nascimento,v_admissao,v_ativo,now()
      );
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'inserted',v_inserted,
    'updated',v_updated,
    'errors',v_errors,
    'processed',jsonb_array_length(p_rows)
  );
end;
$$;

revoke execute on function public.kt_admin_import_colaboradores(jsonb) from public,anon;
grant execute on function public.kt_admin_import_colaboradores(jsonb) to authenticated;
