import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/prose";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description:
    "Condições para uso da plataforma LumiHunter AI: conta, planos, uso aceitável, integrações e responsabilidades.",
};

const UPDATED_AT = "31 de agosto de 2026";

export default function TermosPage() {
  return (
    <LegalDoc title="Termos de Uso" updatedAt={UPDATED_AT}>
      <p>
        Estes Termos regulam o uso da plataforma <strong>LumiHunter AI</strong>,
        disponível em{" "}
        <a href="https://lumihunter.vercel.app">lumihunter.vercel.app</a>. Ao criar
        uma conta ou usar o serviço, você concorda com estas condições. Se não
        concordar, não utilize a plataforma.
      </p>

      <h2>1. O serviço</h2>
      <p>
        O LumiHunter AI é um software de prospecção B2B e CRM que utiliza agentes
        de inteligência artificial para pesquisar empresas em fontes públicas,
        qualificar leads, gerar mensagens e acompanhar o funil de vendas, com
        envio por WhatsApp Cloud API e e-mail.
      </p>

      <h2>2. Conta</h2>
      <ul>
        <li>
          Você deve fornecer dados verdadeiros e manter suas credenciais em
          sigilo. É responsável por toda atividade realizada na sua conta.
        </li>
        <li>
          É necessário ter capacidade civil e, ao representar uma empresa, poderes
          para aceitar estes Termos em nome dela.
        </li>
        <li>
          Cada empresa cadastrada tem seus dados isolados. O administrador
          controla os papéis e acessos dos demais usuários.
        </li>
      </ul>

      <h2>3. Planos e cobrança</h2>
      <p>
        Os planos e limites exibidos na página de preços são referência. Enquanto a
        cobrança automatizada não estiver ativa, o uso é liberado sem custo, sem
        garantia de manutenção dessas condições. Alterações de preço e limites
        serão comunicadas com antecedência razoável.
      </p>

      <h2>4. Uso aceitável</h2>
      <p>Você concorda em não utilizar a plataforma para:</p>
      <ul>
        <li>
          Enviar spam, mensagens enganosas ou conteúdo ilícito, ofensivo ou que
          viole direitos de terceiros.
        </li>
        <li>
          Descumprir a LGPD, o Marco Civil da Internet ou as políticas da Meta e
          da Resend quanto a mensagens e consentimento do destinatário.
        </li>
        <li>
          Contatar pessoas que tenham manifestado recusa (opt-out) ou que estejam
          na blacklist da sua empresa.
        </li>
        <li>
          Realizar engenharia reversa, sobrecarregar a infraestrutura, burlar
          limites ou acessar dados de outras empresas.
        </li>
        <li>Revender o serviço sem autorização por escrito.</li>
      </ul>
      <p>
        Você é o único responsável pelas mensagens que dispara e pela base de
        contatos que utiliza, incluindo a existência de base legal para o contato.
      </p>

      <h2>5. Conteúdo gerado por IA</h2>
      <p>
        As sugestões, scores, textos e análises produzidos pelos agentes de IA são
        apoio à decisão e podem conter erros ou imprecisões. Revise antes de
        enviar ou agir. O LumiHunter não garante resultados comerciais.
      </p>

      <h2>6. Dados de leads e fontes públicas</h2>
      <p>
        O agente de prospecção coleta apenas informações publicamente disponíveis
        e não inventa contatos — campos sem fonte ficam vazios. Ao importar ou
        tratar dados de terceiros na plataforma, você declara ter fundamento legal
        para isso e assume o papel de controlador desses dados.
      </p>

      <h2>7. Integrações de terceiros</h2>
      <p>
        O uso de WhatsApp Cloud API, Resend, Google e outros serviços integrados
        está sujeito aos termos desses provedores. Credenciais que você conectar
        são armazenadas para operar os envios em seu nome e podem ser removidas a
        qualquer momento nas configurações.
      </p>

      <h2>8. Propriedade intelectual</h2>
      <p>
        O software, a marca e a interface do LumiHunter AI pertencem a nós. Seus
        dados, catálogo e base de leads permanecem seus. Concedemos a você uma
        licença de uso não exclusiva e intransferível enquanto durar a conta.
      </p>

      <h2>9. Disponibilidade</h2>
      <p>
        Empenhamo-nos para manter o serviço no ar, mas ele é fornecido &ldquo;no
        estado em que se encontra&rdquo;. Pode haver interrupções para manutenção,
        atualizações ou por falhas de provedores externos.
      </p>

      <h2>10. Limitação de responsabilidade</h2>
      <p>
        Na máxima extensão permitida pela lei, o LumiHunter não responde por danos
        indiretos, lucros cessantes ou perda de dados. A responsabilidade total
        fica limitada ao valor pago pelo serviço nos 3 meses anteriores ao evento.
      </p>

      <h2>11. Encerramento</h2>
      <p>
        Você pode encerrar a conta quando quiser. Podemos suspender ou encerrar
        contas que violem estes Termos, com aviso quando possível. Após o
        encerramento, os dados são tratados conforme a{" "}
        <a href="/privacidade">Política de Privacidade</a>.
      </p>

      <h2>12. Alterações e foro</h2>
      <p>
        Estes Termos podem ser atualizados; mudanças relevantes serão comunicadas.
        Aplica-se a lei brasileira, ficando eleito o foro do domicílio do usuário
        consumidor quando aplicável.
      </p>

      <h2>13. Contato</h2>
      <p>
        Dúvidas sobre estes Termos:{" "}
        <a href="mailto:jessicamarianecosta@gmail.com">
          jessicamarianecosta@gmail.com
        </a>
        .
      </p>
    </LegalDoc>
  );
}
