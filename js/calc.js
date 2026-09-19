/**
 * Núcleo de cálculo do app MEI: guia mensal (DAS-MEI), recálculo por atraso
 * (multa + juros) e Declaração Anual (DASN-SIMEI).
 *
 * Este módulo não depende do DOM, para poder ser testado isoladamente
 * (Node) e reutilizado pela interface (app.js).
 */
(function (global) {
  "use strict";

  // Salário mínimo nacional por ano-calendário (usado para o INSS do MEI = 5%).
  // Atualize esta tabela todo ano, assim que o novo salário mínimo for publicado.
  const SALARIO_MINIMO = {
    2022: 1212.0,
    2023: 1320.0,
    2024: 1412.0,
    2025: 1518.0,
  };

  const VALOR_ICMS = 1.0; // Comércio e Indústria
  const VALOR_ISS = 5.0; // Serviços

  const LIMITE_ANUAL_MEI = 81000.0;

  // Feriados nacionais de data fixa (MM-DD). Feriados móveis (Carnaval,
  // Sexta-feira Santa, Corpus Christi) não estão incluídos: confira o
  // calendário oficial ao emitir a guia perto dessas datas.
  const FERIADOS_FIXOS = [
    "01-01",
    "04-21",
    "05-01",
    "09-07",
    "10-12",
    "11-02",
    "11-15",
    "11-20",
    "12-25",
  ];

  function round2(valor) {
    return Math.round((valor + Number.EPSILON) * 100) / 100;
  }

  function salarioMinimoDoAno(ano) {
    return SALARIO_MINIMO[ano] ?? null;
  }

  function isFimDeSemana(date) {
    const dia = date.getUTCDay();
    return dia === 0 || dia === 6;
  }

  function isFeriadoFixo(date) {
    const mmdd =
      String(date.getUTCMonth() + 1).padStart(2, "0") +
      "-" +
      String(date.getUTCDate()).padStart(2, "0");
    return FERIADOS_FIXOS.includes(mmdd);
  }

  function proximoDiaUtil(date) {
    const d = new Date(date.getTime());
    while (isFimDeSemana(d) || isFeriadoFixo(d)) {
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return d;
  }

  /**
   * Vencimento do DAS-MEI: dia 20 do mês seguinte à competência,
   * antecipado/prorrogado para o próximo dia útil quando cai em fim de
   * semana ou feriado nacional de data fixa.
   */
  function calcularVencimento(anoCompetencia, mesCompetencia) {
    let mes = mesCompetencia + 1;
    let ano = anoCompetencia;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
    const venc = new Date(Date.UTC(ano, mes - 1, 20));
    return proximoDiaUtil(venc);
  }

  /**
   * Calcula o valor da guia mensal (DAS-MEI) para uma competência e atividade.
   * atividade: 'comercio_industria' | 'servicos' | 'comercio_servicos'
   * salarioMinimoManual: opcional, sobrepõe a tabela (necessário para anos
   * ainda não cadastrados em SALARIO_MINIMO).
   */
  function calcularDAS({ ano, mes, atividade, salarioMinimoManual }) {
    const sm = salarioMinimoManual ?? salarioMinimoDoAno(ano);
    if (!sm || sm <= 0) {
      throw new Error(
        `Salário mínimo de ${ano} não cadastrado. Informe manualmente.`
      );
    }
    const inss = round2(sm * 0.05);
    let adicional = 0;
    let rotuloAdicional = "";
    if (atividade === "comercio_industria") {
      adicional = VALOR_ICMS;
      rotuloAdicional = "ICMS";
    } else if (atividade === "servicos") {
      adicional = VALOR_ISS;
      rotuloAdicional = "ISS";
    } else if (atividade === "comercio_servicos") {
      adicional = round2(VALOR_ICMS + VALOR_ISS);
      rotuloAdicional = "ICMS + ISS";
    } else {
      throw new Error("Atividade inválida.");
    }
    const total = round2(inss + adicional);
    const vencimento = calcularVencimento(ano, mes);
    return {
      ano,
      mes,
      atividade,
      salarioMinimo: sm,
      inss,
      adicional,
      rotuloAdicional,
      total,
      vencimento,
    };
  }

  function diferencaEmDias(dataInicio, dataFim) {
    const MS_DIA = 24 * 60 * 60 * 1000;
    const a = Date.UTC(
      dataInicio.getUTCFullYear(),
      dataInicio.getUTCMonth(),
      dataInicio.getUTCDate()
    );
    const b = Date.UTC(
      dataFim.getUTCFullYear(),
      dataFim.getUTCMonth(),
      dataFim.getUTCDate()
    );
    return Math.round((b - a) / MS_DIA);
  }

  function mesesEntre(vencimento, pagamento) {
    // Lista de {ano, mes} de cada mês INTEIRO decorrido entre o mês seguinte
    // ao vencimento e o mês anterior ao pagamento (ambos inclusive).
    const meses = [];
    let ano = vencimento.getUTCFullYear();
    let mes = vencimento.getUTCMonth() + 1 + 1; // mês seguinte ao vencimento
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
    const anoPag = pagamento.getUTCFullYear();
    const mesPag = pagamento.getUTCMonth() + 1;
    while (ano < anoPag || (ano === anoPag && mes < mesPag)) {
      meses.push({ ano, mes });
      mes += 1;
      if (mes > 12) {
        mes = 1;
        ano += 1;
      }
    }
    return meses;
  }

  /**
   * Recalcula o valor da guia quando o pagamento ocorre após o vencimento.
   * taxasSelicMensais: array de números (%) na mesma ordem/quantidade de
   * mesesEntre(vencimento, pagamento) — um valor por mês inteiro decorrido.
   */
  function calcularAtraso({ guia, dataPagamento, taxasSelicMensais = [] }) {
    const vencimento = guia.vencimento;
    const diasAtraso = diferencaEmDias(vencimento, dataPagamento);
    if (diasAtraso <= 0) {
      return {
        diasAtraso: 0,
        multaPercentual: 0,
        multaValor: 0,
        jurosPercentual: 0,
        jurosValor: 0,
        total: guia.total,
        emAtraso: false,
      };
    }

    const multaPercentual = Math.min(round2(diasAtraso * 0.33), 20);
    const multaValor = round2((guia.total * multaPercentual) / 100);

    const meses = mesesEntre(vencimento, dataPagamento);
    const somaSelic = taxasSelicMensais
      .slice(0, meses.length)
      .reduce((soma, taxa) => soma + (Number(taxa) || 0), 0);
    // 1% sempre incide no mês do pagamento, além da SELIC acumulada dos
    // meses inteiros decorridos.
    const jurosPercentual = round2(somaSelic + 1);
    const jurosValor = round2((guia.total * jurosPercentual) / 100);

    const total = round2(guia.total + multaValor + jurosValor);

    return {
      diasAtraso,
      meses,
      multaPercentual,
      multaValor,
      jurosPercentual,
      jurosValor,
      total,
      emAtraso: true,
    };
  }

  /**
   * Prepara os números da Declaração Anual (DASN-SIMEI).
   */
  function calcularDeclaracaoAnual({
    ano,
    receitaComercio,
    receitaServicos,
    abriuNoAno,
    mesAbertura,
  }) {
    const receitaTotal = round2(
      (Number(receitaComercio) || 0) + (Number(receitaServicos) || 0)
    );
    const mesesAtividade = abriuNoAno ? 13 - mesAbertura : 12;
    const limite = round2((LIMITE_ANUAL_MEI / 12) * mesesAtividade);
    const excedeu = receitaTotal > limite;
    const excessoValor = excedeu ? round2(receitaTotal - limite) : 0;
    const excessoPercentual = excedeu ? round2((excessoValor / limite) * 100) : 0;
    const excessoAcimaDe20 = excedeu && excessoPercentual > 20;

    return {
      ano,
      receitaComercio: round2(Number(receitaComercio) || 0),
      receitaServicos: round2(Number(receitaServicos) || 0),
      receitaTotal,
      mesesAtividade,
      limite,
      excedeu,
      excessoValor,
      excessoPercentual,
      excessoAcimaDe20,
    };
  }

  const api = {
    SALARIO_MINIMO,
    LIMITE_ANUAL_MEI,
    round2,
    salarioMinimoDoAno,
    calcularVencimento,
    calcularDAS,
    calcularAtraso,
    calcularDeclaracaoAnual,
    diferencaEmDias,
    mesesEntre,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.MeiCalc = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
