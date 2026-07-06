-- 0008_corretor_telefone
-- Telefone/WhatsApp do corretor (para enviar o recibo direto pela conversa).

alter table public.corretores
  add column if not exists telefone text;
