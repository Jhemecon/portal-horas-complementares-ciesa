// ARQUIVO: Config_Globais.gs
// Contém todas as variáveis de configuração do projeto.

// Versão 1.6: Cálculo automático de horas deferidas.
const VERSAO_SCRIPT = '1.6.0';
const DATA_VERSAO = '2025-11-05';

const NOME_DA_ABA_RESPOSTAS = "Respostas ao formulário 1";
const NOME_DA_ABA_RESUMO = "Resumo";
const TEXTO_STATUS_APROVADO = "Deferido";
const TEXTO_STATUS_REJEITADO = "Indeferido";

// === CONSTANTES DE COLUNAS (Aba Respostas) ===
const COLUNA_EMAIL_ALUNO = 2; // Coluna B
const COLUNA_NOME_ALUNO = 3; // Coluna C
const COLUNA_MATRICULA_ALUNO = 4; // Coluna D
const COLUNA_CATEGORIA_NUMERO = 5; // Coluna E (Categoria CIESA oficial)
const COLUNA_HORAS_DEFERIDAS = 7; // Coluna G
const COLUNA_DATA_CERTIFICADO = 8; // Coluna H
const COLUNA_LINK_DRIVE = 9; // Coluna I
const COLUNA_STATUS_NUMERO = 10; // Coluna J (Status)
const COLUNA_JUSTIFICATIVA_NUMERO = 11; // Coluna K (Justificativa)

// === CONSTANTES DE COLUNAS (Aba Resumo) ===
// Coluna B (onde está a matrícula na aba Resumo)
const COLUNA_RESUMO_MATRICULA_NUMERO = 2; 

// [ALTERADO] O total agora está na Coluna C
const COLUNA_RESUMO_TOTAL_HORAS_NUMERO = 3; 

// [NOVO] Meta de horas conforme o PDF
const TOTAL_HORAS_META = 140;
