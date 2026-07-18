-- 0016_escopo_joinville
-- Novo escopo "Zefer Joinville": uma carteira/caixa própria, como o pessoal,
-- porém alimentada só por lançamentos manuais (sem receber distribuição de
-- entrada). Naturezas de entrada e saída próprias.

alter type public.lancamento_escopo add value if not exists 'joinville';
alter type public.lancamento_natureza add value if not exists 'entrada_joinville';
alter type public.lancamento_natureza add value if not exists 'saida_joinville';
