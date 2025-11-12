// ARQUIVO: Principal_onEdit.gs
// Contém a função de gatilho principal que monitora as edições.

/**
 * Função acionada pelo ACIONADOR INSTALÁVEL (Trigger "Ao editar").
 * Esta função delega o trabalho para handleEdit.
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e O evento de edição.
 */
function onEditHandler(e) {
  try {
    // Chama a lógica principal
    handleEdit(e);
  } catch (err) {
    Logger.log(`ERRO FATAL em onEditHandler: ${err.message} Stack: ${err.stack}`);
    // Tenta registrar um erro na célula se 'range' estiver disponível
    if (e && e.range) {
      try {
        e.range.setNote(`ERRO GERAL DO SCRIPT: ${err.message}`);
      } catch (noteErr) {
        Logger.log(`Falha ao definir a nota de erro: ${noteErr.message}`);
      }
    }
  }
}

/**
 * Processa a lógica de edição.
 * (Separado para facilitar testes e clareza)
 */
function handleEdit(e) {
  // Pega as informações sobre a edição
  const range = e.range;
  const sheet = range.getSheet();
  const valorEditado = e.value;
  const linhaEditada = range.getRow();

  // 1. VERIFICA SE A EDIÇÃO FOI NAS CONDIÇÕES CORRETAS
  if (sheet.getName() === NOME_DA_ABA_RESPOSTAS && 
      range.getColumn() === COLUNA_STATUS_NUMERO && 
      linhaEditada > 1) { // Ignora o cabeçalho
    
    // 2. Decide qual ação tomar baseado no valor
    if (valorEditado === TEXTO_STATUS_APROVADO) {
      Logger.log(`CONDIÇÕES DE APROVAÇÃO ATENDIDAS (Linha ${linhaEditada}). Chamando função...`);
      enviarEmailDeAprovacao(sheet, linhaEditada, range);
      
    } else if (valorEditado === TEXTO_STATUS_REJEITADO) {
      Logger.log(`CONDIÇÕES DE REJEÇÃO ATENDIDAS (Linha ${linhaEditada}). Chamando função...`);
      enviarEmailDeRejeicao(sheet, linhaEditada, range);
    }
    
  } else {
    //Logger.log("CONDIÇÕES NÃO ATENDIDAS. Nenhuma ação será tomada.");
  }
}
