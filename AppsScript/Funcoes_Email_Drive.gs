// ARQUIVO: Funcoes_Email_Drive.gs
// Contém as funções de lógica de negócio (Envio de e-mail, manipulação do Drive).
// VERSÃO 1.6: Cálculo automático de horas deferidas (remove "tiro no pé")

/**
 * Envia o e-mail de APROVAÇÃO e compartilha o arquivo do Drive.
 * (Versão 1.6: Calcula as horas reais aplicadas, ignorando o valor da Col G se estourar o limite)
 */
function enviarEmailDeAprovacao(sheet, linha, range) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const abaResumo = spreadsheet.getSheetByName(NOME_DA_ABA_RESUMO);
  
  let notaErroDrive = null;
  let notaErroEmail = null;
  
  // Pega a célula de horas da Coluna G
  const cellHorasDeferidas = sheet.getRange(linha, COLUNA_HORAS_DEFERIDAS);
  const horasSolicitadas = cellHorasDeferidas.getValue(); // Ex: 10

  try {
    // --- 1. COLETA E VALIDAÇÃO DE DADOS ---
    const emailAluno = sheet.getRange(linha, COLUNA_EMAIL_ALUNO).getValue();
    const nomeAluno = sheet.getRange(linha, COLUNA_NOME_ALUNO).getValue();
    const matriculaAluno = sheet.getRange(linha, COLUNA_MATRICULA_ALUNO).getValue();
    const dataCertificado = sheet.getRange(linha, COLUNA_DATA_CERTIFICADO).getValue();
    const linkDrive = sheet.getRange(linha, COLUNA_LINK_DRIVE).getValue();

    if (!isEmail(emailAluno)) { throw new Error("E-mail do aluno inválido."); }
    if (!linkDrive || String(linkDrive).trim().length < 10) { throw new Error("Link do Drive parece inválido ou está vazio."); }
    const horasNum = Number(horasSolicitadas);
    if (isNaN(horasNum) || horasNum <= 0) { throw new Error("Horas deferidas (Col G) devem ser > 0."); }

    // --- [NOVO] LÓGICA DE CÁLCULO AUTOMÁTICO DE HORAS ---
    
    // 1. Apaga temporariamente o valor da Col G para pegar o "Total Antes"
    cellHorasDeferidas.setValue(0);
    SpreadsheetApp.flush(); // Força o recálculo do Resumo
    const totalHorasAntes = buscarTotalHoras(abaResumo, matriculaAluno); // Ex: 25
    
    // 2. Devolve o valor original para a Col G para pegar o "Total Depois"
    cellHorasDeferidas.setValue(horasSolicitadas); // Ex: 10
    SpreadsheetApp.flush(); // Força o recálculo do Resumo (com o MIN aplicando o limite)
    const totalHorasDepois = buscarTotalHoras(abaResumo, matriculaAluno); // Ex: 30
    
    // 3. Calcula a diferença real que foi somada
    const horasReaisDeferidas = totalHorasDepois - totalHorasAntes; // Ex: 30 - 25 = 5
    // --- FIM DA NOVA LÓGICA ---
    
    // --- 3. COMPARTILHAMENTO DO DRIVE ---
    try {
      compartilharArquivoDrive(linkDrive);
    } catch (e) {
      Logger.log(`ERRO DE DRIVE (Linha ${linha}): Falha ao compartilhar. Link: ${linkDrive}. Erro: ${e.message}`);
      notaErroDrive = `FALHA DRIVE: ${e.message}.`;
    }
  
    // --- 4. BUSCA DO TOTAL DE HORAS ---
    // Usamos o 'totalHorasDepois' que já calculamos
    const totalHorasAluno = totalHorasDepois;

    // --- 5. FORMATAÇÃO DA DATA ---
    const dataFormatada = formatarDataCertificado(dataCertificado, spreadsheet);

    // --- 6. ENVIO DO E-MAIL ---
    const linkLogo = "https://drive.google.com/uc?id=1fsyWl2zvcWaFhXld_EZXeKFX00KlFUhM";
    const corAzulCiesa = "#0028a5";
    const corVerdeCiesa = "#65d340";
    const corTextoPrincipal = "#333333";
    const corFundoEmail = "#f4f7f6";
    const corFundoCartao = "#ffffff";
    
    // --- LÓGICA DE MENSAGEM (V1.5) ---
    let assuntoEmail = "";
    let mensagemTotalFormatada = "";
    let detalhamentoCategoriasHTML = ""; 

    if (totalHorasAluno >= TOTAL_HORAS_META) {
        // --- META ATINGIDA ---
        assuntoEmail = "Parabéns! Você completou suas Horas Complementares!";
        mensagemTotalFormatada = `Parabéns, <b>${nomeAluno}</b>! Você atingiu a meta de ${TOTAL_HORAS_META} horas complementares!`;
        
        try {
          const dadosResumo = abaResumo.getDataRange().getValues();
          const cabecalhosResumo = dadosResumo[0]; 
          let dadosAlunoRow = null;
          const matriculaLimpa = String(matriculaAluno).trim();

          for (let i = 1; i < dadosResumo.length; i++) {
            const matriculaResumo = dadosResumo[i][COLUNA_RESUMO_MATRICULA_NUMERO - 1]; 
            if (String(matriculaResumo).trim() === matriculaLimpa) {
              dadosAlunoRow = dadosResumo[i];
              break;
            }
          }

          if (dadosAlunoRow) {
            detalhamentoCategoriasHTML = `<p style="margin-bottom: 15px; font-size: 15px;">Seu <b>novo total de horas complementares</b> é de: <b style="color: ${corVerdeCiesa};">${totalHorasAluno} horas</b>.</p>`
                                         + `<p style="margin-bottom: 10px; font-size: 15px;">Este total foi composto por:</p>`
                                         + '<ul style="font-size: 14px; color: #333; line-height: 1.7; margin-top: 0; padding-left: 20px;">';
            
            const startColumnIndex = 3; // Coluna D (início das categorias)
            const endColumnIndex = 19;  // Coluna T (fim das categorias)

            for (let j = startColumnIndex; j <= endColumnIndex; j++) {
              const horasCategoria = Number(dadosAlunoRow[j]);
              if (horasCategoria > 0) {
                const nomeCategoria = cabecalhosResumo[j];
                detalhamentoCategoriasHTML += `<li><b>${nomeCategoria}:</b> ${horasCategoria} horas</li>`;
              }
            }
            detalhamentoCategoriasHTML += "</ul>";
          }
        } catch (e) {
          Logger.log(`Erro ao gerar detalhamento de categorias: ${e.message}`);
          detalhamentoCategoriasHTML = "Não foi possível gerar o detalhamento de categorias.";
        }
        // --- FIM BLOCO META ATINGIDA ---

    } else {
        // --- META PENDENTE ---
        assuntoEmail = "Atualização das suas Horas Complementares - Deferido";
        const horasFaltantes = TOTAL_HORAS_META - totalHorasAluno;
        mensagemTotalFormatada = `Seu <b>novo total de horas complementares</b> é de: <b style="color: ${corAzulCiesa}; font-size: 17px;">${totalHorasAluno} horas</b>.`
                                 + `<br><span style="font-size: 14px; color: #555;">Faltam <b>${horasFaltantes} horas</b> para atingir a meta de ${TOTAL_HORAS_META} horas.</span>`;
    }
    
    const assunto = assuntoEmail;
    
    // Carrega o template HTML
    const template = HtmlService.createTemplateFromFile("email_aprovacao");
    
    // Passa todas as variáveis para o template
    template.nomeAluno = nomeAluno;
    template.matriculaAluno = matriculaAluno;
    template.dataFormatada = dataFormatada;
    
    // [ALTERAÇÃO CRÍTICA V1.6] Usa o valor calculado (Ex: 5) e não o solicitado (Ex: 10)
    template.horasDeferidasNestaAcao = horasReaisDeferidas; 
    
    template.linkDrive = linkDrive;
    template.totalHorasAluno = totalHorasAluno; 
    template.mensagemTotal = mensagemTotalFormatada; 
    template.metaHoras = TOTAL_HORAS_META;
    template.detalhamentoCategorias = detalhamentoCategoriasHTML; 

    // Passa variáveis de estilo
    template.linkLogo = linkLogo;
    template.corAzulCiesa = corAzulCiesa;
    template.corVerdeCiesa = corVerdeCiesa;
    template.corTextoPrincipal = corTextoPrincipal;
    template.corFundoEmail = corFundoEmail;
    template.corFundoCartao = corFundoCartao;
    
    const corpoHTML = template.evaluate().getContent();
    
    MailApp.sendEmail({
      to: emailAluno,
      subject: assunto, 
      htmlBody: corpoHTML 
    });

    Logger.log(`E-mail de aprovação enviado (Calculado: ${horasReaisDeferidas}h) para ${emailAluno} (Linha ${linha}).`);
  
  } catch (e) {
    Logger.log(`ERRO FATAL (Aprovação): Falha no envio ou validação. Linha: ${linha}. Erro: ${e.message}`);
    notaErroEmail = `FALHA: ${e.message}`;
    // Se falhar, restaura o valor original da Col G por segurança
    cellHorasDeferidas.setValue(horasSolicitadas);
  }

  // --- 7. FEEDBACK VISUAL SEGURO ---
  if (range) {
    if (notaErroEmail) {
      range.setNote(notaErroEmail);
    } else if (notaErroDrive) {
      range.setNote(`${notaErroDrive} E-mail enviado.`);
    } else {
      range.clearNote();
    }
  }
}


/**
 * Envia o e-mail de REJEIÇÃO (Indeferido).
 * (Sem alterações)
 */
function enviarEmailDeRejeicao(sheet, linha, range) {
  try {
    // --- 1. COLETA E VALIDAÇÃO DE DADOS ---
    const emailAluno = sheet.getRange(linha, COLUNA_EMAIL_ALUNO).getValue();
    const nomeAluno = sheet.getRange(linha, COLUNA_NOME_ALUNO).getValue();
    const justificativa = sheet.getRange(linha, COLUNA_JUSTIFICATIVA_NUMERO).getValue();

    if (!isEmail(emailAluno)) {
      throw new Error("E-mail do aluno inválido.");
    }
    if (!justificativa || String(justificativa).trim().length < 5) {
      throw new Error("Justificativa é obrigatória (mín. 5 caracteres).");
    }

    // --- 2. ENVIO DO E-MAIL ---
    const linkLogo = "https://drive.google.com/uc?id=1fsyWl2zvcWaFhXld_EZXeKFX00KlFUhM";
    const corAzulCiesa = "#0028a5";
    const corLaranjaAlerta = "#f0ad4e"; 
    const corTextoPrincipal = "#333333";
    const corFundoEmail = "#f4f7f6";
    const corFundoCartao = "#ffffff";
    const assunto = "Pendência nas suas Horas Complementares - Indeferido";

    const template = HtmlService.createTemplateFromFile("email_rejeicao");
    template.nomeAluno = nomeAluno;
    template.justificativa = justificativa;
    template.linkLogo = linkLogo;
    template.corAzulCiesa = corAzulCiesa;
    template.corLaranjaAlerta = corLaranjaAlerta;
    template.corTextoPrincipal = corTextoPrincipal;
    template.corFundoEmail = corFundoEmail;
    template.corFundoCartao = corFundoCartao;

    const corpoHTML = template.evaluate().getContent();

    MailApp.sendEmail({
      to: emailAluno,
      subject: assunto,
      htmlBody: corpoHTML
    });
    
    Logger.log(`E-mail de rejeição enviado para ${emailAluno} (Linha ${linha}).`);

    if (range) {
      range.clearNote();
    }

  } catch (e) {
    Logger.log(`ERRO FATAL (Rejeição): Falha no envio ou validação. Linha: ${linha}. Erro: ${e.message}`);
    if (range) {
      range.setNote(`FALHA: ${e.message}`);
    }
  }
}


// ===================================================================
// FUNÇÕES AUXILIARES (Sem alterações)
// ===================================================================

/**
 * Validador de e-mail simples.
 */
function isEmail(val) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val||""));
}

/**
 * Extrai o ID do arquivo de vários formatos de link do Drive.
 */
function extrairFileId(linkDrive) {
  if (!linkDrive) return null;
  const link = String(linkDrive).trim();
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]{20,})/i,          // /d/ID
    /id=([a-zA-Z0-9_-]{20,})/i,            // ?id=ID
    /\/file\/d\/([a-zA-Z0-9_-]{20,})/i,      // /file/d/ID
    /\/u\/\d\/d\/([a-zA-Z0-9_-]{20,})/i,      // /u/0/d/ID
    /drive\.google\.com\/open\?id=([^\&\s]+)/i,
    /drive\.google\.com\/uc\?id=([^\&\s]+)/i
  ];
  for (let re of patterns) {
    const m = link.match(re);
    if (m && m[1]) return decodeURIComponent(m[1]);
  }
  const generic = link.match(/([a-zA-Z0-9_-]{20,})/);
  if (generic && generic[1]) return generic[1];
  return null;
}

/**
 * Tenta extrair o ID e compartilhar um arquivo no Drive.
 */
function compartilharArquivoDrive(linkDrive) {
  const fileId = extrairFileId(linkDrive);
  if (!fileId) {
    Logger.log("AVISO: Não foi possível extrair fileId do link: " + linkDrive);
    throw new Error("ID do arquivo inválido ou não extraído do link.");
  }

  try {
    const file = DriveApp.getFileById(fileId);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); 
    Logger.log(`Arquivo compartilhado id=${fileId}`);
  } catch (e) {
    Logger.log(`ERRO DE DRIVE: Não foi possível acessar o fileId "${fileId}". O arquivo pode não existir ou permissões são insuficientes. Erro: ${e.message}`);
    throw new Error(`Falha no Drive (ID: ${fileId}). ${e.message}`);
  }
}


/**
 * Busca o total de horas de um aluno na aba Resumo.
 */
function buscarTotalHoras(abaResumo, matriculaAluno) {
  const dadosResumo = abaResumo.getDataRange().getValues();
  let totalHorasAluno = 0; 

  if (!matriculaAluno) {
    Logger.log("Aviso: Matrícula do aluno não fornecida para buscarTotalHoras.");
    return 0;
  }
  
  const matriculaLimpa = String(matriculaAluno).trim();
  
  for (let i = 1; i < dadosResumo.length; i++) {
    const matriculaResumo = dadosResumo[i][COLUNA_RESUMO_MATRICULA_NUMERO - 1];
    
    if (String(matriculaResumo).trim() === matriculaLimpa) {
      totalHorasAluno = Number(dadosResumo[i][COLUNA_RESUMO_TOTAL_HORAS_NUMERO - 1]) || 0;
      break;
    }
  }
  
  if (totalHorasAluno === 0 && matriculaLimpa) {
      Logger.log(`Aviso: Matrícula ${matriculaLimpa} não encontrada na aba Resumo. Total retornado: 0.`);
  }
  
  return totalHorasAluno;
}

/**
 * Formata um objeto de data ou string para DD/MM/AAAA.
 */
function formatarDataCertificado(dataCertificado, spreadsheet) {
  let dataFormatada = "Não informada";
  try {
    if (dataCertificado && dataCertificado instanceof Date) {
      dataFormatada = Utilities.formatDate(dataCertificado, spreadsheet.getSpreadsheetTimeZone(), "dd/MM/yyyy");
    } else if (dataCertificado) {
      const dataObj = new Date(dataCertificado);
      if (!isNaN(dataObj.getTime())) {
          dataFormatada = Utilities.formatDate(dataObj, spreadsheet.getSpreadsheetTimeZone(), "dd/MM/yyyy");
      } else {
          dataFormatada = String(dataCertificado); 
      }
    }
  } catch(e) {
    dataFormatada = String(dataCertificado); 
  }
  return dataFormatada;
}
