-- =============================================================================
-- Storage — bucket de anexos e recibos
-- Guarda comprovantes de despesas e recibos de adiantamento.
-- Caminhos usam UUID (não enumeráveis); bucket público para link direto.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', true)
on conflict (id) do nothing;

-- Leitura pública (o caminho é um UUID não adivinhável).
create policy "anexos_read"
  on storage.objects for select
  using (bucket_id = 'anexos');

-- Upload/edição/remoção apenas por usuários autenticados.
create policy "anexos_insert"
  on storage.objects for insert
  with check (bucket_id = 'anexos' and auth.uid() is not null);

create policy "anexos_update"
  on storage.objects for update
  using (bucket_id = 'anexos' and auth.uid() is not null);

create policy "anexos_delete"
  on storage.objects for delete
  using (bucket_id = 'anexos' and auth.uid() is not null);
