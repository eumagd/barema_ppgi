# Considerações do sistema — Plataforma de Gerenciamento de Baremas (PPGI/UFAL)

Material interno da equipe, retirado das telas do sistema na versão 2: anotações de requisitos
(RF/RNF), registros de mudanças por tela, fluxos, avaliação heurística e paleta.
Equipe: Anna Beatriz Bernardo, Magdiel Santos e Mariana Lessa · Orientação: Prof. Dr. Ranilson Paiva.

---

## 1. Paleta institucional

| Cor | Hex | Uso previsto | Observação de acessibilidade |
| --- | --- | --- | --- |
| Azul escuro | `#04469F` | títulos, textos, ícones e logo | — |
| Azul claro | `#BFCFE6` | textos secundários | Contraste de 1,5:1 sobre branco. No sistema é usado em bordas e superfícies; textos secundários usam `#4A5A75` (7:1). |
| Amarelo | `#FFDE59` | faixas de destaque e marcadores | Texto sobre amarelo sempre em preto. |
| Branco | `#FFFFFF` | fundos | Componentes em branco sobre fundo de página `#F6F8FC`. |
| Preto | `#000000` | texto de corpo | — |

Modo escuro (v2): superfícies `#121B2E`, fundo `#0B1220`, azul de destaque `#8AB4F8`, texto `#E8EEF8`.

---

## 2. Rastreio de requisitos por tela

| Tela | Requisitos | Anotação |
| --- | --- | --- |
| Docentes do IC (W-01) | RF02 · RNF02 | Sincronização do Lattes em lote, com confirmação, barra de progresso e resultado com falhas explicadas. Cor amarela + rótulo “PPGI” identificam o vínculo (não depende só da cor). |
| Vínculo com o PPGI (W-02) | RF01 | Na v2 virou filtro da tela de Docentes. Colunas de status, validade e pontuação ficam no perfil. |
| Perfil do docente (W-01P) | RF01 | Ponto central do docente: identificação, resumo do ciclo e abas. |
| Credenciamento (W-04) | RF01 · RF04 · RF06 · RF08 | A correspondência aproximada de nomes pode errar; por isso a revisão humana das coautorias vem antes do cálculo. |
| Relatório (W-05) | RF05 · RF07 | A checagem dos critérios mínimos acontece antes do disparo; se algum não for atendido, o sistema avisa e pede confirmação. |
| Cálculo (W-06) | RF05 · RF06 | A coluna “Coautores PPGI” vem da revisão de coautorias: artigos em coautoria com outros docentes do programa têm a pontuação dividida igualmente. |
| Requisitos (W-07) | RF05 · RF07 | “Previsto” vem do barema da Resolução nº 1/2025; “Apurado” consolida cálculo, histórico acadêmico e cadastro. Folga negativa = quanto falta. |
| Fluxos e avaliação (AV) | RNF03 | — |

---

## 3. Registro de mudanças por tela

Legenda: **Monitor** = feedback do monitor · **Equipe** = alteração da equipe · **Sugestão** = sugestão de revisão · **Mantido**.

### Docentes do IC
| Origem | Área | Problema | Mudança | Critério |
| --- | --- | --- | --- | --- |
| Equipe | Tabela | Muitas colunas (status Lattes, data, link, ações) poluíam a consulta. | Somente docente, departamento, vínculo institucional e PPGI. | H8 |
| Equipe | Vínculo PPGI | Associação ao PPGI pouco visível. | Faixa amarela na linha + rótulo “PPGI”. | H1 · Acessibilidade |
| Equipe | Busca e filtros | Quatro campos de filtro sempre visíveis. | Uma busca + filtros compactos. | H8 · H7 |
| Equipe | Sincronização | Sincronizar por seleção misturava consulta e processo. | “Sincronizar todos” em lote, com confirmação, progresso e resultado. | H5 · H1 |
| Equipe | Nome do docente | Sem acesso ao detalhe individual. | Nome clicável leva ao perfil. | H6 |
| Sugestão | Cadastrar no PPGI | Ação administrativa no meio da consulta. | Removida daqui (área da secretaria). | H8 |
| Equipe (v2) | Vínculo com o PPGI | Tela separada era igual à de Docentes. | Unificada: filtros de vínculo (PPGI, Permanentes, Colaboradores, Fora do PPGI) na mesma tela, com “Desvincular” quando o filtro é do PPGI. | H4 · H8 |

### Vínculo com o PPGI
| Origem | Área | Problema | Mudança | Critério |
| --- | --- | --- | --- | --- |
| Equipe | Tela vira filtro | Duas listagens quase iguais. | Filtro “Somente PPGI” da listagem. | H4 · H8 |
| Equipe | Colunas | Status, validade e pontos poluíam a tabela. | Detalhes ficam no perfil. | H8 |
| Equipe | Desvincular | Não havia como retirar um docente do programa. | Ação destrutiva com confirmação e “desfazer”. | H3 · H5 |
| Monitor | Botão “Ver perfil” | Nome e botão levavam à mesma página. | Só o nome clicável. | H8 |

### Perfil do docente
| Origem | Área | Problema | Mudança | Critério |
| --- | --- | --- | --- | --- |
| Monitor | Atalhos duplicados | Cartões com botões de Cálculo, Requisitos, Relatório e Credenciamento repetiam as abas. | Resumo de leitura; abas como único caminho. | H8 |
| Monitor | Botão “Voltar” | Repetia a trilha de navegação. | Removido. | H8 |
| Equipe | Nova tela | Funções do docente espalhadas. | Perfil centraliza identificação e situação. | H6 |
| Equipe | Flag de participação | Não havia como registrar a recusa do docente. | Sinalização com confirmação e “desfazer”. | H1 · H3 · H5 |

### Cálculo do barema
| Origem | Área | Problema | Mudança | Critério |
| --- | --- | --- | --- | --- |
| Monitor | Botão “Ver relatório” | Repetia a aba Relatório. | Ficou só “Gerar relatório”. | H8 |
| Equipe | Contexto do docente | Seletor solto, sem saber de quem era o cálculo. | Identificação do docente e abas fixas. | H1 · H6 |
| Sugestão | Período compartilhado | Período escolhido de novo em cada tela. | Vale para cálculo, requisitos e relatório. | H6 · H7 |

### Verificação de requisitos
| Origem | Área | Problema | Mudança | Critério |
| --- | --- | --- | --- | --- |
| Monitor | Botão “Abrir cálculo” | Repetia a aba Cálculo. | Removido. | H8 |
| Equipe | Apto, mas não credenciado | Sistema não avisava quando o docente podia ser credenciado. | Aviso com “Iniciar credenciamento”, só quando se aplica. | H1 |
| Mantido | Matriz | — | Atende/Não atende sempre com ícone e texto. | H2 · H8 |

### Relatório do docente
| Origem | Área | Problema | Mudança | Critério |
| --- | --- | --- | --- | --- |
| Equipe | Disparo | Envio sem confirmação. | Confirmação com destinatário e registro do envio. | H5 |
| Sugestão | Docente da prévia | Prévia mostrava outro docente. | Sempre do docente aberto. | H4 · H6 |
| Sugestão | Verificação | “Verificar critérios” era caixa de seleção. | Virou botão com resultado visível. | H2 |

### Credenciamento
| Origem | Área | Problema | Mudança | Critério |
| --- | --- | --- | --- | --- |
| Equipe | Sem etapas | Assistente de 5 etapas era longo. | Tudo em uma tela, com resumo ao lado. | H7 · H8 |
| Equipe | Modo em lote | Processo repetido docente a docente. | Alternância Individual / Em lote. | H7 |
| Equipe | Prévia de coautorias | Coautorias erradas entravam no cálculo. | Caixa para desmarcar e aviso de baixa confiança. | H3 · H5 |
| Equipe (v2) | Nome no menu | “Credenciamento em lote” limitava a tela. | Menu mostra só “Credenciamento”; o modo é escolhido na tela. | H4 |
| Equipe (v2) | Conferência do lote | Não dava para conferir se os docentes atendiam aos critérios. | Tabela de conferência com pontuação, requisitos e pendências de cada docente, e opção de remover os não aptos. | H1 · H5 |

---

## 4. Fluxos principais

- **Consultar um docente:** Docentes → Buscar / filtrar → Perfil do docente
- **Verificar e credenciar:** Perfil → Aba Requisitos → Aviso “apto, não credenciado” → Aba Credenciamento → Revisar coautorias → Confirmar
- **Gerar e enviar relatório:** Perfil → Aba Cálculo → Gerar relatório → Verificar critérios → Confirmar envio
- **Credenciar em lote:** Menu Credenciamento → Em lote → Selecionar docentes → Conferir requisitos → Revisar coautorias → Confirmar
- **Desvincular do PPGI:** Docentes → Filtro PPGI → Desvincular → Confirmar → Desfazer (opcional)
- **Acesso:** Página inicial → Entrar → (Esqueci minha senha → E-mail → Redefinir senha) → Painel

---

## 5. Avaliação pelas 10 heurísticas de Nielsen

| Código | Heurística | Como o protótipo atende | Situação |
| --- | --- | --- | --- |
| H1 | Visibilidade do status | Cabeçalho do docente, avisos de sucesso, progresso da sincronização. | Atendido |
| H2 | Correspondência com o mundo real | Termos da resolução (barema, estrato, coautoria). | Atendido |
| H3 | Controle e liberdade | “Desfazer” em desvincular e sinalização; cancelar em todos os fluxos. | Atendido |
| H4 | Consistência e padrões | Mesmas abas, botões e alertas em todas as telas do docente. | Atendido |
| H5 | Prevenção de erros | Confirmações antes de ações irreversíveis; revisão de coautorias; aviso ao enviar relatório ou iniciar lote com pendências. | Atendido |
| H6 | Reconhecer em vez de lembrar | Trilha de navegação, docente sempre visível e período lembrado. | Atendido |
| H7 | Flexibilidade e eficiência | Credenciamento em lote, “sincronizar todos”, exportação em planilha. | Atendido |
| H8 | Design minimalista | Um único caminho para cada função; fundo liso; colunas reduzidas. | Atendido |
| H9 | Recuperação de erros | Falhas da sincronização e do login explicadas com o que fazer. | Atendido |
| H10 | Ajuda e documentação | Blocos “Como ler” e glossário no perfil. | Parcial |

## 6. Cinco critérios de usabilidade

| Critério | Evidência | Situação |
| --- | --- | --- |
| Eficácia | Todos os fluxos principais podem ser concluídos no protótipo. | Atendido |
| Eficiência | Menos telas por tarefa; lote e período compartilhado. | Atendido |
| Facilidade de aprendizado | Padrões repetidos, legendas e glossário. | Atendido |
| Prevenção / tolerância a erros | Confirmações, desfazer e revisão humana das coautorias. | Atendido |
| Acessibilidade | Status com ícone e texto; foco visível; contraste corrigido; teclado; celular; modo escuro. | Parcial |

---

## 7. Feedbacks recebidos e o que foi feito

**Monitor (16/10/2026)**
- Botões muito próximos no perfil levando à mesma página (cálculo, requisitos, relatórios, credenciamento) → abas viraram o único caminho.
- Fundo quadriculado com a mesma cor dos componentes → removido; fundo liso.

**Equipe (18/10/2026)**
- Página inicial de site convencional (o que é, quem somos, acesso) no lugar do índice de telas → feito, com telas de login, recuperação e redefinição de senha.
- Retirar paleta, anotações e “Fluxos e avaliação” do sistema → retirados e guardados neste documento.
- Barra lateral só para navegação; “Vínculo com o PPGI” unificado com Docentes por filtros → feito.
- “Credenciamento em lote” → “Credenciamento”, com conferência dos requisitos do lote antes de iniciar → feito.
- Nome: “Plataforma de Gerenciamento de Baremas” → aplicado.
- Modo escuro → adicionado.

## 8. Pontos pendentes

- Confirmar: a sincronização do Lattes fica só como “sincronizar todos”?
- Definir as consequências de sinalizar “não deseja participar”.
- Validar com a coordenação os valores mínimos dos requisitos (Resolução nº 1/2025).
- Definir perfis de acesso: o que a secretaria e a coordenação podem ver e fazer.
- Testar os fluxos com usuários reais da secretaria.
