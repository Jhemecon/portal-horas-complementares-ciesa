// ARQUIVO: WebApp_API.gs
// Este arquivo implementa a API REST para o Portal de Horas Complementares
// VERSÃO 1.7: Endpoint para consulta de dados dos alunos

/**
 * Função principal que responde a requisições HTTP GET
 * Esta é a função obrigatória para Web Apps do Google Apps Script
 * @param {Object} e - Objeto de evento contendo os parâmetros da requisição
 * @returns {GoogleAppsScript.Content.TextOutput} Resposta JSON
 */
function doGet(e) {
  try {
    // Habilita CORS para permitir requisições do frontend
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    
    // Verifica se o evento e os parâmetros existem
    if (!e || !e.parameter) {
      return criarRespostaErro("Requisição inválida - parâmetros ausentes", output);
    }
    
    // Verifica se a matrícula foi fornecida
    if (!e.parameter.matricula) {
      return criarRespostaErro("Matrícula não fornecida", output);
    }
    
    const matricula = String(e.parameter.matricula).trim();
    
    // Valida formato da matrícula (ajuste conforme seu padrão)
    if (matricula.length < 3) {
      return criarRespostaErro("Matrícula inválida", output);
    }
    
    // Busca os dados do aluno
    const dadosAluno = buscarDadosAluno(matricula);
    
    if (!dadosAluno) {
      return criarRespostaErro("Matrícula não encontrada", output);
    }
    
    // Retorna os dados em formato JSON
    output.setContent(JSON.stringify({
      sucesso: true,
      dados: dadosAluno
    }));
    
    return output;
    
  } catch (erro) {
    Logger.log(`Erro em doGet: ${erro.message}`);
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    return criarRespostaErro(`Erro interno: ${erro.message}`, output);
  }
}

/**
 * Busca todos os dados de um aluno pela matrícula
 * @param {string} matricula - Matrícula do aluno
 * @returns {Object|null} Objeto com os dados do aluno ou null se não encontrado
 */
function buscarDadosAluno(matricula) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const abaResumo = spreadsheet.getSheetByName(NOME_DA_ABA_RESUMO);
    
    if (!abaResumo) {
      Logger.log("Erro: Aba 'Resumo' não encontrada");
      return null;
    }
    
    const matriculaLimpa = String(matricula).trim();
    
    // Busca otimizada usando TextFinder
    const finder = abaResumo.getRange(2, COLUNA_RESUMO_MATRICULA_NUMERO, abaResumo.getLastRow() - 1, 1)
      .createTextFinder(matriculaLimpa)
      .matchEntireCell(true)
      .findNext();
    
    if (!finder) {
      Logger.log(`Matrícula ${matriculaLimpa} não encontrada`);
      return null;
    }
    
    const linha = finder.getRow();
    const dadosResumo = abaResumo.getDataRange().getValues();
    const cabecalhos = dadosResumo[0];
    const dadosLinha = dadosResumo[linha - 1];
    
    // Monta o objeto com os dados do aluno
    const dados = {
      nome: dadosLinha[1] || "Não informado", // Coluna B (assumindo que o nome está aqui)
      matricula: dadosLinha[COLUNA_RESUMO_MATRICULA_NUMERO - 1],
      totalHoras: Number(dadosLinha[COLUNA_RESUMO_TOTAL_HORAS_NUMERO - 1]) || 0,
      metaHoras: TOTAL_HORAS_META,
      horasFaltantes: Math.max(0, TOTAL_HORAS_META - (Number(dadosLinha[COLUNA_RESUMO_TOTAL_HORAS_NUMERO - 1]) || 0)),
      metaAtingida: (Number(dadosLinha[COLUNA_RESUMO_TOTAL_HORAS_NUMERO - 1]) || 0) >= TOTAL_HORAS_META,
      percentualConcluido: Math.min(100, Math.round(((Number(dadosLinha[COLUNA_RESUMO_TOTAL_HORAS_NUMERO - 1]) || 0) / TOTAL_HORAS_META) * 100)),
      categorias: []
    };
    
    // Adiciona as categorias com horas
    for (let i = COLUNA_INICIO_CATEGORIAS; i <= COLUNA_FIM_CATEGORIAS; i++) {
      const horasCategoria = Number(dadosLinha[i]) || 0;
      if (horasCategoria > 0) {
        dados.categorias.push({
          nome: cabecalhos[i],
          horas: horasCategoria
        });
      }
    }
    
    Logger.log(`Dados encontrados para matrícula ${matriculaLimpa}: ${dados.totalHoras} horas`);
    return dados;
    
  } catch (erro) {
    Logger.log(`Erro em buscarDadosAluno: ${erro.message}`);
    return null;
  }
}

/**
 * Cria uma resposta de erro padronizada em JSON
 * @param {string} mensagem - Mensagem de erro
 * @param {GoogleAppsScript.Content.TextOutput} output - Objeto de saída
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function criarRespostaErro(mensagem, output) {
  output.setContent(JSON.stringify({
    sucesso: false,
    erro: mensagem
  }));
  return output;
}

/**
 * Função de teste para simular requisições
 * Execute esta função no editor do Apps Script para testar
 * 
 * INSTRUÇÕES:
 * 1. Substitua "12345" por uma matrícula REAL da sua planilha
 * 2. Clique em "Executar" (▶️) no topo
 * 3. Veja os resultados em "Execuções" > "Logs"
 */
function testarDoGet() {
  Logger.log("=== TESTE DA API (doGet) ===");
  Logger.log("📍 Iniciando teste com matrícula de exemplo...");
  
  // ⚠️ IMPORTANTE: COLOQUE UMA MATRÍCULA VÁLIDA AQUI ANTES DE EXECUTAR
  const MATRICULA_TESTE = "25000324"; // <--- EDITE AQUI COM UMA MATRÍCULA REAL
  
  Logger.log(`🔍 Buscando dados para matrícula: ${MATRICULA_TESTE}`);
  
  // Simula um evento com parâmetros (igual ao que vem do frontend)
  const eventoTeste = {
    parameter: {
      matricula: MATRICULA_TESTE
    }
  };
  
  const resultado = doGet(eventoTeste);
  const conteudo = resultado.getContent();
  
  Logger.log("📨 Resposta da API:");
  Logger.log(conteudo);
  Logger.log(""); // Linha em branco para clareza
  
  // Tenta fazer o parse do JSON para verificar formato
  try {
    const json = JSON.parse(conteudo);
    Logger.log("✅ JSON parseado com sucesso!");
    Logger.log("📊 Estrutura dos dados:");
    Logger.log(JSON.stringify(json, null, 2));
    
    if (json.sucesso) {
      Logger.log(`✅ Sucesso! Dados encontrados para: ${json.dados.nome}`);
      Logger.log(`📈 Total de horas: ${json.dados.totalHoras}/${json.dados.metaHoras}`);
      Logger.log(`🎯 Meta atingida: ${json.dados.metaAtingida ? "SIM" : "NÃO"}`);
    } else {
      Logger.log(`❌ Erro: ${json.erro}`);
    }
    
  } catch (e) {
    Logger.log("❌ Erro ao fazer parse do JSON: " + e.message);
  }
  
  Logger.log("");
  Logger.log("=== FIM DO TESTE ===");
  Logger.log("💡 Dica: Se deu erro, verifique se:");
  Logger.log("   1. A matrícula existe na planilha");
  Logger.log("   2. O nome da aba 'Resumo' está correto");
  Logger.log("   3. As colunas estão nos índices corretos");
}

/**
 * Função para testar com uma matrícula inexistente
 */
function testarMatriculaInexistente() {
  Logger.log("=== TESTE COM MATRÍCULA INEXISTENTE ===");
  
  const eventoTeste = {
    parameter: {
      matricula: "99999999"
    }
  };
  
  const resultado = doGet(eventoTeste);
  Logger.log(resultado.getContent());
  
  Logger.log("=== FIM DO TESTE ===");
}

/**
 * Função para testar sem parâmetros
 */
function testarSemParametros() {
  Logger.log("=== TESTE SEM PARÂMETROS ===");
  
  const eventoTeste = {
    parameter: {}
  };
  
  const resultado = doGet(eventoTeste);
  Logger.log(resultado.getContent());
  
  Logger.log("=== FIM DO TESTE ===");
}

/**
 * 🔍 DIAGNÓSTICO COMPLETO DA PLANILHA
 * Execute esta função para verificar se tudo está configurado corretamente
 */
function diagnosticarPlanilha() {
  Logger.log("=== 🔍 DIAGNÓSTICO DA PLANILHA ===");
  Logger.log("");
  
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    Logger.log(`✅ Planilha aberta: "${spreadsheet.getName()}"`);
    Logger.log("");
    
    // Verifica a aba Resumo
    Logger.log("📋 Verificando aba 'Resumo'...");
    const abaResumo = spreadsheet.getSheetByName(NOME_DA_ABA_RESUMO);
    
    if (!abaResumo) {
      Logger.log(`❌ ERRO: Aba "${NOME_DA_ABA_RESUMO}" não encontrada!`);
      Logger.log("📝 Abas disponíveis:");
      spreadsheet.getSheets().forEach(sheet => {
        Logger.log(`   - ${sheet.getName()}`);
      });
      return;
    }
    
    Logger.log(`✅ Aba "Resumo" encontrada`);
    Logger.log(`📊 Linhas totais: ${abaResumo.getLastRow()}`);
    Logger.log(`📊 Colunas totais: ${abaResumo.getLastColumn()}`);
    Logger.log("");
    
    // Verifica os cabeçalhos
    Logger.log("📌 Verificando cabeçalhos...");
    const cabecalhos = abaResumo.getRange(1, 1, 1, abaResumo.getLastColumn()).getValues()[0];
    
    Logger.log(`Coluna ${COLUNA_RESUMO_MATRICULA_NUMERO} (Matrícula): "${cabecalhos[COLUNA_RESUMO_MATRICULA_NUMERO - 1]}"`);
    Logger.log(`Coluna ${COLUNA_RESUMO_TOTAL_HORAS_NUMERO} (Total Horas): "${cabecalhos[COLUNA_RESUMO_TOTAL_HORAS_NUMERO - 1]}"`);
    Logger.log("");
    
    // Verifica primeiras 3 matrículas
    Logger.log("🎓 Primeiras matrículas encontradas:");
    const dados = abaResumo.getRange(2, 1, Math.min(3, abaResumo.getLastRow() - 1), COLUNA_RESUMO_TOTAL_HORAS_NUMERO).getValues();
    
    dados.forEach((linha, index) => {
      const nome = linha[1] || "Sem nome";
      const matricula = linha[COLUNA_RESUMO_MATRICULA_NUMERO - 1];
      const totalHoras = linha[COLUNA_RESUMO_TOTAL_HORAS_NUMERO - 1];
      Logger.log(`   ${index + 1}. ${nome} - Matrícula: ${matricula} - Horas: ${totalHoras}`);
    });
    
    Logger.log("");
    Logger.log("✅ DIAGNÓSTICO CONCLUÍDO COM SUCESSO!");
    Logger.log("💡 Use uma das matrículas acima para testar a função testarDoGet()");
    
  } catch (erro) {
    Logger.log(`❌ ERRO NO DIAGNÓSTICO: ${erro.message}`);
    Logger.log(`Stack: ${erro.stack}`);
  }
  
  Logger.log("");
  Logger.log("=== FIM DO DIAGNÓSTICO ===");
}

/**
 * 🧪 TESTE RÁPIDO COM PRIMEIRA MATRÍCULA DISPONÍVEL
 * Esta função busca automaticamente a primeira matrícula e testa
 */
function testarComPrimeiraMatricula() {
  Logger.log("=== 🧪 TESTE AUTOMÁTICO ===");
  Logger.log("");
  
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const abaResumo = spreadsheet.getSheetByName(NOME_DA_ABA_RESUMO);
    
    if (!abaResumo) {
      Logger.log("❌ Aba Resumo não encontrada");
      return;
    }
    
    // Pega a primeira matrícula (linha 2)
    const primeiraMatricula = abaResumo.getRange(2, COLUNA_RESUMO_MATRICULA_NUMERO).getValue();
    
    if (!primeiraMatricula) {
      Logger.log("❌ Nenhuma matrícula encontrada na linha 2");
      return;
    }
    
    Logger.log(`🔍 Testando com matrícula: ${primeiraMatricula}`);
    Logger.log("");
    
    const eventoTeste = {
      parameter: {
        matricula: String(primeiraMatricula)
      }
    };
    
    const resultado = doGet(eventoTeste);
    const json = JSON.parse(resultado.getContent());
    
    if (json.sucesso) {
      Logger.log("✅ SUCESSO!");
      Logger.log(`👤 Nome: ${json.dados.nome}`);
      Logger.log(`🎓 Matrícula: ${json.dados.matricula}`);
      Logger.log(`⏱️ Total de horas: ${json.dados.totalHoras}`);
      Logger.log(`🎯 Meta: ${json.dados.metaHoras}`);
      Logger.log(`📊 Percentual: ${json.dados.percentualConcluido}%`);
      Logger.log(`✨ Meta atingida: ${json.dados.metaAtingida ? "SIM" : "NÃO"}`);
      Logger.log("");
      Logger.log("📚 Categorias com horas:");
      json.dados.categorias.forEach(cat => {
        Logger.log(`   - ${cat.nome}: ${cat.horas}h`);
      });
    } else {
      Logger.log(`❌ Erro: ${json.erro}`);
    }
    
  } catch (erro) {
    Logger.log(`❌ ERRO: ${erro.message}`);
  }
  
  Logger.log("");
  Logger.log("=== FIM DO TESTE ===");
}
