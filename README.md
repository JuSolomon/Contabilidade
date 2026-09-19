# MEI Calculadora

Aplicativo web (HTML/CSS/JS puro, sem dependências ou build) para apoiar o
Microempreendedor Individual em três tarefas:

1. **Guia mensal (DAS-MEI)** — calcula INSS + ICMS/ISS da competência
   escolhida, conforme a atividade (Comércio/Indústria, Serviços, ou ambos),
   e mostra a data de vencimento (dia 20 do mês seguinte, ajustada para o
   próximo dia útil).
2. **Recalcular atraso** — quando o prazo passou, calcula multa de mora
   (0,33%/dia, limitada a 20%) e juros (SELIC acumulada dos meses inteiros
   de atraso + 1% no mês do pagamento), chegando ao valor total atualizado.
3. **Declaração Anual (DASN-SIMEI)** — organiza a receita bruta do ano
   (comércio/indústria e serviços), calcula o limite anual (proporcional se
   o CNPJ foi aberto no meio do ano) e indica se o limite foi excedido e em
   que percentual.

Há também uma aba de **Histórico**, que salva os cálculos localmente no
navegador (`localStorage`) para consulta posterior — nada é enviado para
servidores externos.

Cada resultado tem atalhos para agilizar a parte oficial:

- **Copiar resumo/checklist** — copia os valores calculados para a área de
  transferência, prontos para colar no PGMEI ou na DASN-SIMEI.
- **Lembrete (.ics)** — baixa um arquivo de calendário com a data de
  vencimento da guia ou o prazo da declaração anual (31/maio).
- **Imprimir / salvar PDF** — gera uma folha de conferência imprimível.
- **Abrir PGMEI / DASN-SIMEI oficial** — leva direto para a página oficial
  correta no site da Receita Federal.

## Como usar

Abra `index.html` diretamente no navegador, ou sirva a pasta com qualquer
servidor estático, por exemplo:

```bash
python3 -m http.server 8000
# depois acesse http://localhost:8000
```

## Importante — isto não substitui o app oficial

Esta ferramenta **calcula valores para conferência e organização**. Ela não
emite a guia oficial com código de barras nem envia a Declaração Anual à
Receita Federal — nenhum aplicativo de terceiros consegue fazer isso, pois a
Receita Federal não disponibiliza API pública para emissão do DAS-MEI nem
para envio da DASN-SIMEI, e um código de barras gerado fora do sistema
oficial não seria válido para pagamento.

Por isso o app te leva direto para o lugar certo: os botões "Abrir PGMEI
oficial" e "Abrir DASN-SIMEI oficial" apontam para as páginas oficiais da
Receita Federal, e os botões de copiar/checklist deixam os valores prontos
para colar lá, sem digitar de novo.

## Atualização anual dos parâmetros

Os valores tributários do MEI mudam todo ano. Antes de usar o app em um ano
novo, atualize `js/calc.js`:

- `SALARIO_MINIMO`: adicione o salário mínimo vigente do ano (o INSS do MEI
  é 5% desse valor). Se o ano não estiver na tabela, o app pede o valor
  manualmente na tela.
- `VALOR_ICMS` / `VALOR_ISS`: normalmente R$ 1,00 e R$ 5,00, mas confirme se
  não houve alteração na legislação.
- `LIMITE_ANUAL_MEI`: hoje é R$ 81.000,00/ano; confirme se não mudou.

Para o cálculo de juros por atraso, a taxa SELIC mensal precisa ser
informada manualmente na tela (consulte a série histórica da SELIC no site
do Banco Central do Brasil), pois ela muda todo mês e não é uma regra fixa.

## Estrutura

```
index.html      interface (abas: guia, atraso, anual, histórico)
css/style.css   estilos (claro/escuro automático)
js/calc.js      funções de cálculo puras, sem DOM (testáveis via Node)
js/app.js       ligação entre a interface e js/calc.js, e o histórico local
```

`js/calc.js` não depende do navegador e pode ser testado direto com Node:

```bash
node -e 'const c = require("./js/calc.js"); console.log(c.calcularDAS({ano:2025, mes:1, atividade:"comercio_industria"}));'
```
