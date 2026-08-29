-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 008: RPC opcional para popular a empresa demo "LumiLife"
-- Uso: o usuário logado chama  select public.seed_lumilife();
-- Cria a empresa, vincula o chamador como owner e cadastra o catálogo.
-- Idempotente por usuário (não duplica se já existir vínculo com uma LumiLife).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.seed_lumilife()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
  v_cat_cv uuid;
  v_cat_imp uuid;
  v_cat_brind uuid;
  v_icp uuid;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;

  select c.id into v_company
  from public.companies c
  join public.company_members m on m.company_id = c.id
  where m.user_id = auth.uid() and c.name = 'LumiLife Comunicação Visual'
  limit 1;
  if v_company is not null then
    return v_company;
  end if;

  insert into public.companies (name, legal_name, segment, city, state, description,
    brand_color, commercial_email, onboarding_completed, created_by)
  values ('LumiLife Comunicação Visual', 'LumiLife Comunicação Visual LTDA',
    'Comunicação Visual e Impressão', 'São Paulo', 'SP',
    'Gráfica e comunicação visual: adesivos, rótulos, DTF, banners, cartões e brindes personalizados.',
    '#F5C518', 'contato@lumilife.com.br', true, auth.uid())
  returning id into v_company;

  insert into public.company_members (company_id, user_id, role)
  values (v_company, auth.uid(), 'owner');

  insert into public.product_categories (company_id, name) values
    (v_company, 'Comunicação Visual') returning id into v_cat_cv;
  insert into public.product_categories (company_id, name) values
    (v_company, 'Impressos') returning id into v_cat_imp;
  insert into public.product_categories (company_id, name) values
    (v_company, 'Brindes') returning id into v_cat_brind;

  insert into public.products (company_id, category_id, name, kind, description, price_start, price_avg,
    min_quantity, lead_time_days, keywords, applications, ideal_audience, example_buyers, is_active) values
    (v_company, v_cat_cv, 'Adesivos', 'product', 'Adesivos recortados e impressos em vinil.', 0.50, 2.00, 50, 3,
      array['adesivo','vinil','recorte','rotulagem'], array['identificação','decoração','promoção'],
      'Comércios, indústrias e prestadores de serviço', array['lojas','food trucks','oficinas'], true),
    (v_company, v_cat_imp, 'Rótulos', 'product', 'Rótulos adesivos para embalagens, em bobina ou folha.', 0.30, 1.20, 100, 4,
      array['rótulo','embalagem','bobina','label'], array['embalagem de produto','identificação de lote'],
      'Marcas com produto físico próprio', array['confeitarias','cosméticos','velas artesanais','cafés','produtos naturais'], true),
    (v_company, v_cat_cv, 'DTF', 'product', 'Transfer DTF para estamparia têxtil em qualquer cor de tecido.', 1.00, 3.50, 10, 2,
      array['dtf','estampa','camiseta','uniforme'], array['uniformes','camisetas de evento','moda'],
      'Quem precisa de peças personalizadas', array['academias','escolas','igrejas','lojas de roupa','eventos'], true),
    (v_company, v_cat_cv, 'Banner', 'product', 'Banners em lona com acabamento em ilhós.', 40.00, 90.00, 1, 2,
      array['banner','lona','fachada','evento'], array['fachada','feira','ponto de venda'],
      'Comércios e organizadores de eventos', array['lojas','feiras','igrejas'], true),
    (v_company, v_cat_imp, 'Cartões de visita', 'product', 'Cartões em papel couché ou reciclado com acabamentos.', 30.00, 60.00, 100, 3,
      array['cartão','couché','laminação'], array['networking','apresentação profissional'],
      'Profissionais e pequenas empresas', array['corretores','clínicas','autônomos'], true),
    (v_company, v_cat_imp, 'Panfletos', 'product', 'Panfletos e flyers para divulgação.', 0.10, 0.25, 500, 3,
      array['panfleto','flyer','divulgação'], array['promoção','abertura de loja','campanha'],
      'Comércio local', array['restaurantes','academias','lojas'], true),
    (v_company, v_cat_cv, 'Tags', 'product', 'Tags e etiquetas de papel para produtos e brindes.', 0.20, 0.70, 100, 4,
      array['tag','etiqueta','pingente'], array['precificação','identificação de brinde'],
      'Marcas de moda e artesanato', array['brechós','ateliês','lojas de presente'], true),
    (v_company, v_cat_brind, 'Sacolas personalizadas', 'product', 'Sacolas de papel ou kraft com impressão da marca.', 1.50, 4.00, 100, 7,
      array['sacola','kraft','embalagem'], array['embalagem de loja','kit de evento'],
      'Varejo físico', array['boutiques','floriculturas','docerias'], true),
    (v_company, v_cat_brind, 'Brindes personalizados', 'product', 'Canecas, chaveiros, ecobags e mais, com a marca do cliente.', 5.00, 18.00, 25, 10,
      array['brinde','caneca','chaveiro','ecobag'], array['ação promocional','kit de boas-vindas'],
      'Empresas que fazem ações de marca', array['imobiliárias','startups','eventos corporativos'], true),
    (v_company, v_cat_cv, 'Comunicação Visual (fachadas)', 'service', 'Projeto e instalação de fachadas, letras caixa e luminosos.', 300.00, 1200.00, 1, 15,
      array['fachada','letra caixa','luminoso','acm'], array['identidade do ponto comercial'],
      'Novos negócios e reformas de loja', array['franquias','clínicas','restaurantes'], true);

  insert into public.icp_profiles (company_id, name, description, states, cities, segments, keywords)
  values (v_company, 'Marcas com produto próprio (rótulos/DTF)',
    'Pequenas marcas locais que embalam ou personalizam produtos e podem comprar rótulos, tags e DTF recorrentemente.',
    array['SP'], array['São Paulo','Guarulhos','Osasco','Santo André'],
    array['confeitarias','cosméticos','velas','cafés','alimentos','produtos naturais','academias','escolas','igrejas','lojas de roupa','uniformes','eventos'],
    array['artesanal','feito à mão','encomendas','uniforme','identidade visual'])
  returning id into v_icp;

  insert into public.icp_products (company_id, icp_id, product_id)
  select v_company, v_icp, p.id from public.products p
  where p.company_id = v_company and p.name in ('Rótulos','DTF','Tags','Adesivos');

  update public.companies set onboarding_completed = true where id = v_company;

  return v_company;
end;
$$;

revoke all on function public.seed_lumilife() from public;
grant execute on function public.seed_lumilife() to authenticated;
