// ── Normalização de nomes de caixas ───────────────────────────
export const CAIXA_NORM: Record<string, string> = {
  // Agenda Financeira
  "consultoria agenda financeira": "Consultoria",
  "consultoria": "Consultoria",
  "gestão aluguel estorno": "Gestão Aluguel Estornos",
  "gestão aluguel estornos": "Gestão Aluguel Estornos",
  "gestão aluguel incentivo": "Gestão Aluguel Incentivos",
  "gestão aluguel incentivos": "Gestão Aluguel Incentivos",
  "regularizações financeiras": "Regularizações Financeiras",
  "regularizacoes financeiras": "Regularizações Financeiras",
  "saldo de auditoria": "Saldo de Auditoria",
  "evento 9066": "Evento 9066",
  "9066": "Evento 9066",
  "9066 / agenda financeira": "Evento 9066",
  "evento 9066 (cobrança sinistro)": "Evento 9066",
  "evento 7922": "Evento 7922",
  "7922": "Evento 7922",
  "7922 / 5125": "Evento 7922",
  "evento 5125": "Evento 5125",
  "5125": "Evento 5125",
  "processos ouvidoria bo": "Processos Ouvidoria BO",
  "processos ouvidoria": "Processos Ouvidoria BO",
  "backoffice mídias sociais": "BackOffice Mídias Sociais",
  "backoffice midias sociais": "BackOffice Mídias Sociais",
  "back office mídias sociais": "BackOffice Mídias Sociais",
  "prévia mdr": "Prévia MDR",
  "previa mdr": "Prévia MDR",
  "estorno mdr": "Estorno MDR",
  "atendimento backoffice": "Atendimento BackOffice",
  "atendimento back office": "Atendimento BackOffice",
  "desfazimento": "Desfazimento",
  "std aéreo": "STD Aéreo",
  "std aereo": "STD Aéreo",
  "std corporate": "STD Corporate",
  // Suporte Conciliação
  "suporte conciliação": "Suporte Conciliação",
  "suporte conciliacao": "Suporte Conciliação",
  "conciliação": "Suporte Conciliação",
  "conciliacao": "Suporte Conciliação",
  "suporte": "Suporte Conciliação",
  // Confirmação de Crédito
  "confirmação de crédito": "Confirmação de Crédito",
  "confirmacao de credito": "Confirmação de Crédito",
  "confirmação": "Confirmação de Crédito",
  "confirmacao": "Confirmação de Crédito",
  "chargeback": "Chargeback",
};

export function normCaixa(caixa: string): string {
  if (!caixa) return "";
  return CAIXA_NORM[caixa.toLowerCase().trim()] || caixa;
}

export const PROCESSOS_CAIXAS: Record<string, string[]> = {
  "Agenda Financeira": [
    "Gestão Aluguel Estornos",
    "Gestão Aluguel Incentivos",
    "Regularizações Financeiras",
    "Saldo de Auditoria",
    "Evento 9066",
    "Evento 7922",
    "Evento 5125",
    "Processos Ouvidoria BO",
    "BackOffice Mídias Sociais",
    "Consultoria",
    "Prévia MDR",
    "Estorno MDR",
    "Atendimento BackOffice",
    "Desfazimento",
    "STD Aéreo",
    "STD Corporate",
  ],
  "Suporte Conciliação": ["Suporte Conciliação"],
  "Confirmação de Crédito": [
    "Chargeback",
    "Confirmação de Crédito",
  ],
};

export const PROCESSO_LIST = Object.keys(PROCESSOS_CAIXAS);

export function getProcesso(caixa: string): string {
  const cx = normCaixa(caixa);
  for (const [proc, caixas] of Object.entries(PROCESSOS_CAIXAS)) {
    if (caixas.includes(cx)) return proc;
  }
  return "Outros";
}

// Abreviações para exibição
export const CAIXA_ABREV: Record<string, string> = {
  "Gestão Aluguel Estornos": "GAE",
  "Gestão Aluguel Incentivos": "GAI",
  "Regularizações Financeiras": "RF",
  "Saldo de Auditoria": "Saldo",
  "Evento 9066": "9066",
  "Evento 7922": "7922",
  "Evento 5125": "5125",
  "Processos Ouvidoria BO": "PO-BO",
  "BackOffice Mídias Sociais": "BMS",
  "Consultoria": "Consultoria",
  "Prévia MDR": "Prévia MDR",
  "Estorno MDR": "EMDR",
  "Atendimento BackOffice": "Atend. BO",
  "Desfazimento": "Desfaz.",
  "STD Aéreo": "STD Aéreo",
  "STD Corporate": "STD Corp.",
  "Suporte Conciliação": "Conciliação",
  "Chargeback": "Chargeback",
  "Confirmação de Crédito": "Confirmação",
};
export const abrevCaixa = (cx: string) => CAIXA_ABREV[cx] || cx.split(" ").slice(0, 2).join(" ");
