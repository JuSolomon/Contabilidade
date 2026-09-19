(function () {
  "use strict";

  const MESES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  const ATIVIDADE_ROTULO = {
    comercio_industria: "Comércio e Indústria",
    servicos: "Serviços",
    comercio_servicos: "Comércio e Serviços",
  };

  const HISTORICO_KEY = "mei_app_historico_v1";
  const CNPJ_KEY = "mei_app_cnpj_v1";

  const LINKS_OFICIAIS = {
    pgmei: "https://www8.receita.fazenda.gov.br/simplesnacional/aplicacoes/atspo/pgmei.app/Identificacao",
    dasnSimei: "https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/dasnsimei.app/Identificacao",
  };

  // --- Utilitários: copiar, .ics e impressão ---
  async function copiarTexto(texto, botao) {
    try {
      await navigator.clipboard.writeText(texto);
    } catch (e) {
      window.prompt("Não foi possível copiar automaticamente. Copie o texto abaixo:", texto);
      return;
    }
    if (botao) {
      const original = botao.textContent;
      botao.textContent = "Copiado!";
      setTimeout(() => {
        botao.textContent = original;
      }, 1500);
    }
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function dataParaICS(date) {
    return String(date.getUTCFullYear()) + pad2(date.getUTCMonth() + 1) + pad2(date.getUTCDate());
  }

  function escaparICS(texto) {
    return String(texto)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  }

  function baixarICS(nomeArquivo, { data, titulo, descricao }) {
    const uid = "mei-calculadora-" + Date.now() + "@local";
    const linhas = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//MEI Calculadora//PT-BR",
      "BEGIN:VEVENT",
      "UID:" + uid,
      "DTSTAMP:" + dataParaICS(new Date()) + "T000000Z",
      "DTSTART;VALUE=DATE:" + dataParaICS(data),
      "SUMMARY:" + escaparICS(titulo),
      "DESCRIPTION:" + escaparICS(descricao),
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    const blob = new Blob([linhas.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // --- CNPJ do MEI (salvo localmente, exibido junto com os resultados) ---
  function apenasDigitos(texto) {
    return String(texto || "").replace(/\D/g, "");
  }

  function mascararCNPJ(valor) {
    const d = apenasDigitos(valor).slice(0, 14);
    if (d.length > 12) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, "$1.$2.$3/$4-$5");
    if (d.length > 8) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{1,4})/, "$1.$2.$3/$4");
    if (d.length > 5) return d.replace(/(\d{2})(\d{3})(\d{1,3})/, "$1.$2.$3");
    if (d.length > 2) return d.replace(/(\d{2})(\d{1,3})/, "$1.$2");
    return d;
  }

  function cnpjSalvo() {
    try {
      return mascararCNPJ(localStorage.getItem(CNPJ_KEY) || "");
    } catch (e) {
      return "";
    }
  }

  function configurarCNPJ() {
    const input = document.getElementById("cnpj-mei");
    input.value = cnpjSalvo();
    input.addEventListener("input", () => {
      const formatado = mascararCNPJ(input.value);
      input.value = formatado;
      try {
        localStorage.setItem(CNPJ_KEY, apenasDigitos(formatado));
      } catch (e) {
        // armazenamento indisponível (modo privado etc.) - segue sem persistir
      }
    });
  }

  function exibirCNPJEm(linhaId, valorId) {
    const cnpj = cnpjSalvo();
    const linha = document.getElementById(linhaId);
    linha.hidden = cnpj.length === 0;
    if (cnpj.length > 0) {
      document.getElementById(valorId).textContent = cnpj;
    }
  }

  function imprimirElemento(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.classList.add("imprimir-isto");
    window.addEventListener(
      "afterprint",
      () => el.classList.remove("imprimir-isto"),
      { once: true }
    );
    window.print();
  }

  function formatoMoeda(valor) {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatoData(date) {
    return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  }

  function popularSelectMeses(select) {
    select.innerHTML = "";
    MESES.forEach((nome, indice) => {
      const opt = document.createElement("option");
      opt.value = String(indice + 1);
      opt.textContent = nome;
      select.appendChild(opt);
    });
  }

  function anoAtual() {
    return new Date().getFullYear();
  }

  // --- Navegação entre abas ---
  function configurarAbas() {
    const botoes = document.querySelectorAll("nav.abas button");
    botoes.forEach((botao) => {
      botao.addEventListener("click", () => {
        botoes.forEach((b) => b.classList.remove("ativa"));
        document.querySelectorAll(".painel").forEach((p) => p.classList.remove("ativa"));
        botao.classList.add("ativa");
        document.getElementById("painel-" + botao.dataset.aba).classList.add("ativa");
      });
    });
  }

  // --- Histórico (localStorage) ---
  function lerHistorico() {
    try {
      const bruto = localStorage.getItem(HISTORICO_KEY);
      return bruto ? JSON.parse(bruto) : [];
    } catch (e) {
      return [];
    }
  }

  function salvarHistorico(lista) {
    try {
      localStorage.setItem(HISTORICO_KEY, JSON.stringify(lista));
    } catch (e) {
      // armazenamento indisponível (modo privado etc.) - segue sem persistir
    }
  }

  function adicionarAoHistorico(item) {
    const lista = lerHistorico();
    lista.unshift({ ...item, id: Date.now() + "-" + Math.random().toString(36).slice(2, 7) });
    salvarHistorico(lista);
    renderizarHistorico();
  }

  function renderizarHistorico() {
    const lista = lerHistorico();
    const container = document.getElementById("lista-historico");
    container.innerHTML = "";
    if (lista.length === 0) {
      container.innerHTML = '<div class="vazio">Nenhum registro salvo ainda.</div>';
      return;
    }
    lista.forEach((item) => {
      const div = document.createElement("div");
      div.className = "historico-item";
      div.innerHTML = `
        <div class="info">
          <b>${item.titulo}</b>
          <span>${item.detalhe}</span>
        </div>
        <button class="perigo" data-id="${item.id}">Remover</button>
      `;
      container.appendChild(div);
    });
    container.querySelectorAll("button[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const restante = lerHistorico().filter((i) => String(i.id) !== btn.dataset.id);
        salvarHistorico(restante);
        renderizarHistorico();
      });
    });
  }

  // --- Aba Guia mensal ---
  let ultimaGuiaCalculada = null;

  function configurarAbaGuia() {
    const selMes = document.getElementById("guia-mes");
    const inpAno = document.getElementById("guia-ano");
    popularSelectMeses(selMes);
    const hoje = new Date();
    selMes.value = String(hoje.getMonth() + 1);
    inpAno.value = anoAtual();

    function atualizarVisibilidadeSalario() {
      const ano = Number(inpAno.value);
      const wrapper = document.getElementById("guia-sm-wrapper");
      wrapper.style.display = MeiCalc.salarioMinimoDoAno(ano) ? "none" : "block";
    }
    inpAno.addEventListener("input", atualizarVisibilidadeSalario);
    atualizarVisibilidadeSalario();

    document.getElementById("btn-calcular-guia").addEventListener("click", () => {
      const ano = Number(inpAno.value);
      const mes = Number(selMes.value);
      const atividade = document.querySelector('input[name="guia-atividade"]:checked').value;
      const smManual = Number(document.getElementById("guia-sm-manual").value) || undefined;

      let guia;
      try {
        guia = MeiCalc.calcularDAS({ ano, mes, atividade, salarioMinimoManual: smManual });
      } catch (erro) {
        alert(erro.message);
        return;
      }
      ultimaGuiaCalculada = guia;

      document.getElementById("guia-inss").textContent = formatoMoeda(guia.inss);
      document.getElementById("guia-adicional-rotulo").textContent = guia.rotuloAdicional;
      document.getElementById("guia-adicional").textContent = formatoMoeda(guia.adicional);
      document.getElementById("guia-vencimento").textContent = formatoData(guia.vencimento);
      document.getElementById("guia-total").textContent = formatoMoeda(guia.total);
      exibirCNPJEm("guia-cnpj-linha", "guia-cnpj-valor");
      document.getElementById("resultado-guia").hidden = false;
    });

    document.getElementById("btn-salvar-guia").addEventListener("click", () => {
      if (!ultimaGuiaCalculada) return;
      const g = ultimaGuiaCalculada;
      adicionarAoHistorico({
        tipo: "guia",
        titulo: `Guia ${MESES[g.mes - 1]}/${g.ano} - ${ATIVIDADE_ROTULO[g.atividade]}`,
        detalhe: `Total ${formatoMoeda(g.total)} · vencimento ${formatoData(g.vencimento)}`,
      });
    });

    document.getElementById("btn-copiar-guia").addEventListener("click", (evento) => {
      if (!ultimaGuiaCalculada) return;
      const g = ultimaGuiaCalculada;
      const cnpj = cnpjSalvo();
      const texto = [
        ...(cnpj ? [`CNPJ: ${cnpj}`] : []),
        `DAS-MEI - competência ${MESES[g.mes - 1]}/${g.ano} (${ATIVIDADE_ROTULO[g.atividade]})`,
        `INSS: ${formatoMoeda(g.inss)}`,
        `${g.rotuloAdicional}: ${formatoMoeda(g.adicional)}`,
        `Vencimento: ${formatoData(g.vencimento)}`,
        `Total: ${formatoMoeda(g.total)}`,
      ].join("\n");
      copiarTexto(texto, evento.currentTarget);
    });

    document.getElementById("btn-lembrete-guia").addEventListener("click", () => {
      if (!ultimaGuiaCalculada) return;
      const g = ultimaGuiaCalculada;
      baixarICS(`vencimento-das-mei-${g.ano}-${pad2(g.mes)}.ics`, {
        data: g.vencimento,
        titulo: `Vencimento DAS-MEI ${MESES[g.mes - 1]}/${g.ano}`,
        descricao: `Valor calculado ${formatoMoeda(g.total)}. Emita a guia oficial no PGMEI: ${LINKS_OFICIAIS.pgmei}`,
      });
    });

    document.getElementById("btn-imprimir-guia").addEventListener("click", () => {
      imprimirElemento("resultado-guia");
    });
  }

  // --- Aba Recalcular atraso ---
  let guiaAtrasoCalculada = null;
  let mesesJurosAtraso = [];

  function configurarAbaAtraso() {
    const selMes = document.getElementById("atraso-mes");
    const inpAno = document.getElementById("atraso-ano");
    popularSelectMeses(selMes);
    const hoje = new Date();
    selMes.value = String(hoje.getMonth() + 1);
    inpAno.value = anoAtual();
    document.getElementById("atraso-data-pagamento").value = hoje.toISOString().slice(0, 10);

    function atualizarVisibilidadeSalario() {
      const ano = Number(inpAno.value);
      const wrapper = document.getElementById("atraso-sm-wrapper");
      wrapper.style.display = MeiCalc.salarioMinimoDoAno(ano) ? "none" : "block";
    }
    inpAno.addEventListener("input", atualizarVisibilidadeSalario);
    atualizarVisibilidadeSalario();

    document.getElementById("btn-ver-vencimento").addEventListener("click", () => {
      const ano = Number(inpAno.value);
      const mes = Number(selMes.value);
      const atividade = document.querySelector('input[name="atraso-atividade"]:checked').value;
      const smManual = Number(document.getElementById("atraso-sm-manual").value) || undefined;
      const dataPagStr = document.getElementById("atraso-data-pagamento").value;
      if (!dataPagStr) {
        alert("Informe a data de pagamento.");
        return;
      }
      const dataPagamento = new Date(dataPagStr + "T00:00:00Z");

      let guia;
      try {
        guia = MeiCalc.calcularDAS({ ano, mes, atividade, salarioMinimoManual: smManual });
      } catch (erro) {
        alert(erro.message);
        return;
      }
      guiaAtrasoCalculada = guia;
      mesesJurosAtraso = MeiCalc.mesesEntre(guia.vencimento, dataPagamento);

      const corpo = document.querySelector("#tabela-selic tbody");
      corpo.innerHTML = "";
      mesesJurosAtraso.forEach((m, indice) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${MESES[m.mes - 1]}/${m.ano}</td>
          <td><input type="number" step="0.01" min="0" class="selic-input" data-indice="${indice}" placeholder="0,00" /></td>
        `;
        corpo.appendChild(tr);
      });
      document.getElementById("atraso-selic-wrapper").hidden = false;
      document.getElementById("resultado-atraso").hidden = true;
    });

    document.getElementById("btn-calcular-atraso").addEventListener("click", () => {
      if (!guiaAtrasoCalculada) return;
      const dataPagStr = document.getElementById("atraso-data-pagamento").value;
      const dataPagamento = new Date(dataPagStr + "T00:00:00Z");

      const taxas = Array.from(document.querySelectorAll(".selic-input")).map(
        (input) => Number(input.value) || 0
      );

      const resultado = MeiCalc.calcularAtraso({
        guia: guiaAtrasoCalculada,
        dataPagamento,
        taxasSelicMensais: taxas,
      });

      document.getElementById("atraso-vencimento").textContent = formatoData(guiaAtrasoCalculada.vencimento);
      document.getElementById("atraso-dias").textContent = resultado.diasAtraso + (resultado.diasAtraso === 1 ? " dia" : " dias");
      document.getElementById("atraso-principal").textContent = formatoMoeda(guiaAtrasoCalculada.total);
      document.getElementById("atraso-multa-rotulo").textContent = `Multa de mora (${resultado.multaPercentual.toFixed(2)}%)`;
      document.getElementById("atraso-multa").textContent = formatoMoeda(resultado.multaValor);
      document.getElementById("atraso-juros-rotulo").textContent = `Juros de mora (${resultado.jurosPercentual.toFixed(2)}%)`;
      document.getElementById("atraso-juros").textContent = formatoMoeda(resultado.jurosValor);
      document.getElementById("atraso-total").textContent = formatoMoeda(resultado.total);
      exibirCNPJEm("atraso-cnpj-linha", "atraso-cnpj-valor");
      document.getElementById("resultado-atraso").hidden = false;

      document.getElementById("btn-salvar-atraso").onclick = () => {
        const g = guiaAtrasoCalculada;
        adicionarAoHistorico({
          tipo: "atraso",
          titulo: `Atraso - guia ${MESES[g.mes - 1]}/${g.ano} - ${ATIVIDADE_ROTULO[g.atividade]}`,
          detalhe: `${resultado.diasAtraso} dias · total com multa e juros ${formatoMoeda(resultado.total)}`,
        });
      };

      document.getElementById("btn-copiar-atraso").onclick = (evento) => {
        const g = guiaAtrasoCalculada;
        const cnpj = cnpjSalvo();
        const texto = [
          ...(cnpj ? [`CNPJ: ${cnpj}`] : []),
          `DAS-MEI em atraso - competência ${MESES[g.mes - 1]}/${g.ano} (${ATIVIDADE_ROTULO[g.atividade]})`,
          `Vencimento original: ${formatoData(g.vencimento)}`,
          `Dias em atraso: ${resultado.diasAtraso}`,
          `Valor original: ${formatoMoeda(g.total)}`,
          `Multa (${resultado.multaPercentual.toFixed(2)}%): ${formatoMoeda(resultado.multaValor)}`,
          `Juros (${resultado.jurosPercentual.toFixed(2)}%): ${formatoMoeda(resultado.jurosValor)}`,
          `Total a pagar: ${formatoMoeda(resultado.total)}`,
        ].join("\n");
        copiarTexto(texto, evento.currentTarget);
      };

      document.getElementById("btn-lembrete-atraso").onclick = () => {
        const g = guiaAtrasoCalculada;
        baixarICS(`pagamento-atraso-das-mei-${g.ano}-${pad2(g.mes)}.ics`, {
          data: dataPagamento,
          titulo: `Pagar DAS-MEI em atraso - ${MESES[g.mes - 1]}/${g.ano}`,
          descricao: `Total atualizado ${formatoMoeda(resultado.total)}. Emita a guia oficial no PGMEI: ${LINKS_OFICIAIS.pgmei}`,
        });
      };

      document.getElementById("btn-imprimir-atraso").onclick = () => {
        imprimirElemento("resultado-atraso");
      };
    });
  }

  // --- Aba Declaração anual ---
  let ultimaDeclaracaoCalculada = null;

  function configurarAbaAnual() {
    const inpAno = document.getElementById("anual-ano");
    inpAno.value = anoAtual() - 1; // normalmente declara-se o ano anterior

    const selMesAbertura = document.getElementById("anual-mes-abertura");
    popularSelectMeses(selMesAbertura);

    const chkAbriu = document.getElementById("anual-abriu-no-ano");
    chkAbriu.addEventListener("change", () => {
      document.getElementById("anual-mes-abertura-wrapper").style.display = chkAbriu.checked ? "block" : "none";
    });

    document.getElementById("btn-calcular-anual").addEventListener("click", () => {
      const ano = Number(inpAno.value);
      const receitaComercio = Number(document.getElementById("anual-receita-comercio").value) || 0;
      const receitaServicos = Number(document.getElementById("anual-receita-servicos").value) || 0;
      const abriuNoAno = chkAbriu.checked;
      const mesAbertura = abriuNoAno ? Number(selMesAbertura.value) : null;
      const teveEmpregado = document.getElementById("anual-teve-empregado").checked;

      const resultado = MeiCalc.calcularDeclaracaoAnual({
        ano,
        receitaComercio,
        receitaServicos,
        abriuNoAno,
        mesAbertura,
      });
      ultimaDeclaracaoCalculada = { ...resultado, teveEmpregado };

      document.getElementById("anual-total").textContent = formatoMoeda(resultado.receitaTotal);
      document.getElementById("anual-limite").textContent =
        formatoMoeda(resultado.limite) + (abriuNoAno ? ` (proporcional a ${resultado.mesesAtividade} meses)` : "");

      const situacaoEl = document.getElementById("anual-situacao");
      const excessoDiv = document.getElementById("anual-excesso-linhas");
      const orientacaoEl = document.getElementById("anual-orientacao");
      excessoDiv.innerHTML = "";

      if (!resultado.excedeu) {
        situacaoEl.innerHTML = '<span class="badge ok">Dentro do limite</span>';
        orientacaoEl.textContent =
          "Receita dentro do limite anual do MEI. Preencha a DASN-SIMEI informando a receita de comércio/indústria e de serviços separadamente" +
          (teveEmpregado ? ", e informe que houve empregado contratado no ano." : ".");
      } else {
        situacaoEl.innerHTML = '<span class="badge alerta">Limite excedido</span>';
        excessoDiv.innerHTML = `
          <div class="linha-valor"><span>Valor excedido</span><span>${formatoMoeda(resultado.excessoValor)}</span></div>
          <div class="linha-valor"><span>Percentual excedido</span><span>${resultado.excessoPercentual.toFixed(2)}%</span></div>
        `;
        orientacaoEl.textContent = resultado.excessoAcimaDe20
          ? "O excesso foi maior que 20% do limite: o desenquadramento do Simei tende a ser retroativo ao início das atividades no ano, com reenquadramento no Simples Nacional (ou Microempresa) e possível diferença de tributos a apurar. Consulte um contador para regularizar."
          : "O excesso foi de até 20% do limite: o desenquadramento do Simei normalmente vale a partir de janeiro do ano seguinte, sem efeito retroativo. Ainda assim, informe corretamente na DASN-SIMEI e planeje-se para sair do MEI.";
      }

      const cnpj = cnpjSalvo();
      const itensChecklist = [
        ...(cnpj ? [`CNPJ: ${cnpj}`] : []),
        `Receita bruta - Comércio/Indústria: ${formatoMoeda(resultado.receitaComercio)}`,
        `Receita bruta - Serviços: ${formatoMoeda(resultado.receitaServicos)}`,
        `Teve empregado contratado no ano: ${teveEmpregado ? "Sim" : "Não"}`,
        `Receita bruta total (conferência): ${formatoMoeda(resultado.receitaTotal)}`,
        `Situação frente ao limite: ${resultado.excedeu ? "Limite excedido (" + resultado.excessoPercentual.toFixed(2) + "%)" : "Dentro do limite"}`,
      ];
      const listaChecklist = document.getElementById("anual-checklist-lista");
      listaChecklist.innerHTML = "";
      itensChecklist.forEach((texto) => {
        const li = document.createElement("li");
        li.textContent = texto;
        listaChecklist.appendChild(li);
      });

      exibirCNPJEm("anual-cnpj-linha", "anual-cnpj-valor");
      document.getElementById("resultado-anual").hidden = false;
    });

    document.getElementById("btn-salvar-anual").addEventListener("click", () => {
      if (!ultimaDeclaracaoCalculada) return;
      const d = ultimaDeclaracaoCalculada;
      adicionarAoHistorico({
        tipo: "anual",
        titulo: `Declaração anual ${d.ano}`,
        detalhe: `Receita total ${formatoMoeda(d.receitaTotal)} · limite ${formatoMoeda(d.limite)} · ${d.excedeu ? "excedeu" : "dentro do limite"}`,
      });
    });

    document.getElementById("btn-copiar-anual").addEventListener("click", (evento) => {
      if (!ultimaDeclaracaoCalculada) return;
      const itens = Array.from(document.querySelectorAll("#anual-checklist-lista li")).map(
        (li, indice) => `${indice + 1}) ${li.textContent}`
      );
      const d = ultimaDeclaracaoCalculada;
      const texto = [`Checklist DASN-SIMEI - ano-calendário ${d.ano}`, ...itens].join("\n");
      copiarTexto(texto, evento.currentTarget);
    });

    document.getElementById("btn-lembrete-anual").addEventListener("click", () => {
      if (!ultimaDeclaracaoCalculada) return;
      const d = ultimaDeclaracaoCalculada;
      const prazo = new Date(Date.UTC(d.ano + 1, 4, 31)); // 31 de maio do ano seguinte
      baixarICS(`prazo-dasn-simei-${d.ano}.ics`, {
        data: prazo,
        titulo: `Prazo DASN-SIMEI - ano-calendário ${d.ano}`,
        descricao: `Entregue a Declaração Anual do MEI no site oficial: ${LINKS_OFICIAIS.dasnSimei}`,
      });
    });

    document.getElementById("btn-imprimir-anual").addEventListener("click", () => {
      imprimirElemento("resultado-anual");
    });
  }

  function configurarHistorico() {
    document.getElementById("btn-limpar-historico").addEventListener("click", () => {
      if (confirm("Remover todos os registros salvos neste dispositivo?")) {
        salvarHistorico([]);
        renderizarHistorico();
      }
    });
    renderizarHistorico();
  }

  document.addEventListener("DOMContentLoaded", () => {
    configurarCNPJ();
    configurarAbas();
    configurarAbaGuia();
    configurarAbaAtraso();
    configurarAbaAnual();
    configurarHistorico();
  });
})();
