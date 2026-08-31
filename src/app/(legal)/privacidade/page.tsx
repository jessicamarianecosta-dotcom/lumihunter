import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/prose";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Como o LumiHunter AI coleta, usa, armazena e protege dados pessoais, em conformidade com a LGPD.",
};

const UPDATED_AT = "31 de agosto de 2026";

export default function PrivacidadePage() {
  return (
    <LegalDoc title="Política de Privacidade" updatedAt={UPDATED_AT}>
      <p>
        Esta Política descreve como o <strong>LumiHunter AI</strong> (&ldquo;LumiHunter&rdquo;,
        &ldquo;nós&rdquo;) trata dados pessoais de usuários e visitantes da
        plataforma disponível em{" "}
        <a href="https://lumihunter.vercel.app">lumihunter.vercel.app</a>. O
        tratamento segue a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados –
        LGPD).
      </p>

      <h2>1. Quem é o controlador</h2>
      <p>
        O LumiHunter AI é o controlador dos dados de cadastro e uso da conta.
        Para os leads e contatos que você importa ou pesquisa dentro da
        plataforma, <strong>você (empresa cliente) é o controlador</strong> e o
        LumiHunter atua como operador, tratando esses dados apenas para executar o
        serviço contratado.
      </p>
      <p>
        Contato do encarregado (DPO) e canal de privacidade:{" "}
        <a href="mailto:jessicamarianecosta@gmail.com">
          jessicamarianecosta@gmail.com
        </a>
        .
      </p>

      <h2>2. Dados que coletamos</h2>
      <ul>
        <li>
          <strong>Cadastro e conta:</strong> nome, e-mail, senha (armazenada de
          forma criptografada pelo provedor de autenticação) e, quando você opta
          por entrar com o Google, o nome, e-mail e foto de perfil da conta
          Google.
        </li>
        <li>
          <strong>Dados da empresa:</strong> razão social/nome fantasia,
          segmento, cidade, canais de contato comercial e informações que você
          cadastra sobre produtos e cliente ideal.
        </li>
        <li>
          <strong>Dados de leads e conversas:</strong> informações de empresas e
          contatos que você importa, pesquisa ou recebe por mensagem, incluindo
          histórico de campanhas e respostas.
        </li>
        <li>
          <strong>Dados de uso:</strong> registros de acesso, ações na
          plataforma, execuções de agentes de IA e logs técnicos necessários à
          segurança.
        </li>
      </ul>

      <h2>3. Login com Google</h2>
      <p>
        Ao usar &ldquo;Entrar com Google&rdquo;, solicitamos apenas os escopos
        básicos de <strong>e-mail</strong> e <strong>perfil</strong>. Usamos esses
        dados exclusivamente para criar e autenticar sua conta. Não lemos, enviamos
        nem armazenamos e-mails, contatos, arquivos ou qualquer outro dado da sua
        conta Google. Você pode revogar o acesso a qualquer momento em{" "}
        <a href="https://myaccount.google.com/permissions">
          myaccount.google.com/permissions
        </a>
        .
      </p>

      <h2>4. Para que usamos os dados</h2>
      <ul>
        <li>Criar, autenticar e manter sua conta e suas empresas.</li>
        <li>
          Executar as funções da plataforma: prospecção, qualificação, geração de
          mensagens, envio por WhatsApp e e-mail e acompanhamento do funil.
        </li>
        <li>
          Processar textos com modelos de IA (Claude, da Anthropic) para gerar
          sugestões, scores e análises.
        </li>
        <li>Garantir segurança, prevenir fraude e cumprir obrigações legais.</li>
        <li>Comunicar avisos operacionais e de suporte.</li>
      </ul>

      <h2>5. Bases legais</h2>
      <p>
        Tratamos dados com fundamento na execução de contrato (art. 7º, V),
        cumprimento de obrigação legal (art. 7º, II), legítimo interesse para
        segurança e melhoria do serviço (art. 7º, IX) e, quando aplicável,
        consentimento (art. 7º, I), que pode ser revogado.
      </p>

      <h2>6. Compartilhamento e sub-operadores</h2>
      <p>
        Não vendemos dados pessoais. Compartilhamos dados apenas com prestadores
        necessários à operação, sob contrato e instruções:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — banco de dados, autenticação e armazenamento.
        </li>
        <li>
          <strong>Vercel</strong> — hospedagem da aplicação.
        </li>
        <li>
          <strong>Anthropic</strong> — processamento de texto por IA (sem uso para
          treinamento de modelos).
        </li>
        <li>
          <strong>Meta (WhatsApp Cloud API)</strong> e <strong>Resend</strong> —
          envio de mensagens que você dispara.
        </li>
        <li>
          <strong>Google</strong> — apenas para autenticação, quando você escolhe
          esse método.
        </li>
      </ul>
      <p>
        Alguns prestadores podem processar dados fora do Brasil. Nesses casos
        adotamos salvaguardas compatíveis com a LGPD.
      </p>

      <h2>7. Retenção</h2>
      <p>
        Mantemos os dados enquanto a conta estiver ativa e pelo prazo necessário
        para cumprir obrigações legais. Encerrada a conta, os dados são excluídos
        ou anonimizados em até 90 dias, salvo retenção exigida por lei.
      </p>

      <h2>8. Segurança</h2>
      <p>
        Adotamos criptografia em trânsito, isolamento por empresa via Row Level
        Security, controle de acesso por papéis e registro de auditoria. Nenhum
        método é 100% infalível, mas trabalhamos para reduzir riscos de forma
        contínua.
      </p>

      <h2>9. Seus direitos</h2>
      <p>
        Você pode solicitar confirmação de tratamento, acesso, correção,
        anonimização, portabilidade, eliminação e informações sobre
        compartilhamento, além de revogar consentimento. Basta escrever para{" "}
        <a href="mailto:jessicamarianecosta@gmail.com">
          jessicamarianecosta@gmail.com
        </a>
        . Responderemos nos prazos da LGPD.
      </p>

      <h2>10. Cookies</h2>
      <p>
        Usamos apenas cookies essenciais de sessão e preferências (por exemplo,
        empresa ativa e tema claro/escuro). Não usamos cookies de publicidade.
      </p>

      <h2>11. Alterações</h2>
      <p>
        Podemos atualizar esta Política. Mudanças relevantes serão comunicadas na
        plataforma ou por e-mail, e a data de última atualização acima será
        revista.
      </p>
    </LegalDoc>
  );
}
