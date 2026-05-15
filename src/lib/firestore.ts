import {
  collection,
  query,
  orderBy,
  getDocs,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export interface Avaliacao {
  firestoreId: string;
  data: string;
  analista: string;
  caixa: string;
  nota: number;
  ciclo: number;
  mes: string;
  anoRef: number | string;
  categoria: string;
  desvio?: string;
  nivel?: string;
  tipo?: string;
  timestamp?: string;
  supervisor?: string;
}

export interface Analista {
  firestoreId: string;
  nome: string;
  status: string;
}

const MESES_ORDEM = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

export async function fetchAvaliacoes(anoRef?: number): Promise<Avaliacao[]> {
  const col = collection(db, "controleAvaliacoes");
  const q = anoRef
    ? query(col, where("anoRef", "==", anoRef), orderBy("timestamp", "desc"))
    : query(col, orderBy("timestamp", "desc"));

  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      firestoreId: d.id,
      data: data.data || data.dataInteracao || "",
      analista: data.analista || data.analistaNome || "",
      caixa: data.caixa || "",
      nota: parseFloat(String(data.nota || "0").replace(",", ".")),
      ciclo: data.ciclo || 0,
      mes: data.mes || "",
      anoRef: data.anoRef || new Date().getFullYear(),
      categoria: data.categoria || "",
      desvio: data.desvio || "",
      nivel: data.nivel || data.tipo || "",
      tipo: data.tipo || "",
      timestamp: data.timestamp || "",
      supervisor: data.supervisor || "",
    };
  });
}

export async function fetchAnalistas(): Promise<Analista[]> {
  const col = collection(db, "analistas");
  const q = query(col, orderBy("nome"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    firestoreId: d.id,
    nome: d.data().nome || "",
    status: d.data().status || "Ativo",
  }));
}

// ── Aggregate helpers ──────────────────────────────────────────

export function getMeses(avaliacoes: Avaliacao[]): string[] {
  const unique = [...new Set(avaliacoes.map((a) => a.mes))];
  return unique.sort((a, b) => MESES_ORDEM.indexOf(a) - MESES_ORDEM.indexOf(b));
}

export function getCaixas(avaliacoes: Avaliacao[]): string[] {
  return [...new Set(avaliacoes.map((a) => a.caixa))].filter(Boolean).sort();
}

export function getAnalistas(avaliacoes: Avaliacao[]): string[] {
  return [...new Set(avaliacoes.map((a) => a.analista))].filter(Boolean).sort();
}

export interface KpiData {
  total: number;
  media: number;
  nota100: number;
  ncs: number;
  ncgs: number;
  pctMeta: number;
}

export function calcKpis(avaliacoes: Avaliacao[]): KpiData {
  const total = avaliacoes.length;
  if (total === 0) return { total: 0, media: 0, nota100: 0, ncs: 0, ncgs: 0, pctMeta: 0 };
  const soma = avaliacoes.reduce((s, a) => s + a.nota, 0);
  const media = soma / total;
  const nota100 = avaliacoes.filter((a) => a.nota >= 100).length;
  const ncs = avaliacoes.filter((a) =>
    (a.categoria || "").toUpperCase().includes("NC") &&
    !(a.categoria || "").toUpperCase().includes("NCG")
  ).length;
  const ncgs = avaliacoes.filter((a) =>
    (a.categoria || "").toUpperCase().includes("NCG")
  ).length;
  return { total, media, nota100, ncs, ncgs, pctMeta: (nota100 / total) * 100 };
}

export interface MesData {
  mes: string;
  volume: number;
  media: number;
}

export function byMes(avaliacoes: Avaliacao[]): MesData[] {
  const map: Record<string, { sum: number; count: number }> = {};
  for (const a of avaliacoes) {
    if (!map[a.mes]) map[a.mes] = { sum: 0, count: 0 };
    map[a.mes].sum += a.nota;
    map[a.mes].count += 1;
  }
  return Object.entries(map)
    .map(([mes, { sum, count }]) => ({ mes, volume: count, media: sum / count }))
    .sort((a, b) => MESES_ORDEM.indexOf(a.mes) - MESES_ORDEM.indexOf(b.mes));
}

export interface CicloData {
  ciclo: number;
  volume: number;
  media: number;
}

export function byCiclo(avaliacoes: Avaliacao[]): CicloData[] {
  const map: Record<number, { sum: number; count: number }> = {};
  for (const a of avaliacoes) {
    const c = a.ciclo || 0;
    if (!map[c]) map[c] = { sum: 0, count: 0 };
    map[c].sum += a.nota;
    map[c].count += 1;
  }
  return Object.entries(map)
    .map(([ciclo, { sum, count }]) => ({
      ciclo: Number(ciclo),
      volume: count,
      media: sum / count,
    }))
    .sort((a, b) => a.ciclo - b.ciclo);
}

export interface CaixaData {
  caixa: string;
  volume: number;
  media: number;
  nota100: number;
  ncs: number;
  ncgs: number;
}

export function byCaixa(avaliacoes: Avaliacao[]): CaixaData[] {
  const map: Record<string, { sum: number; count: number; nota100: number; ncs: number; ncgs: number }> = {};
  for (const a of avaliacoes) {
    const k = a.caixa || "Sem caixa";
    if (!map[k]) map[k] = { sum: 0, count: 0, nota100: 0, ncs: 0, ncgs: 0 };
    map[k].sum += a.nota;
    map[k].count += 1;
    if (a.nota >= 100) map[k].nota100 += 1;
    const cat = (a.categoria || "").toUpperCase();
    if (cat.includes("NCG")) map[k].ncgs += 1;
    else if (cat.includes("NC")) map[k].ncs += 1;
  }
  return Object.entries(map)
    .map(([caixa, d]) => ({
      caixa,
      volume: d.count,
      media: d.sum / d.count,
      nota100: d.nota100,
      ncs: d.ncs,
      ncgs: d.ncgs,
    }))
    .sort((a, b) => b.volume - a.volume);
}

export interface AnalistaData {
  analista: string;
  volume: number;
  media: number;
  nota100: number;
  ncs: number;
  ncgs: number;
  caixas: string[];
}

export function byAnalista(avaliacoes: Avaliacao[]): AnalistaData[] {
  const map: Record<string, { sum: number; count: number; nota100: number; ncs: number; ncgs: number; caixas: Set<string> }> = {};
  for (const a of avaliacoes) {
    const k = a.analista || "Desconhecido";
    if (!map[k]) map[k] = { sum: 0, count: 0, nota100: 0, ncs: 0, ncgs: 0, caixas: new Set() };
    map[k].sum += a.nota;
    map[k].count += 1;
    if (a.nota >= 100) map[k].nota100 += 1;
    if (a.caixa) map[k].caixas.add(a.caixa);
    const cat = (a.categoria || "").toUpperCase();
    if (cat.includes("NCG")) map[k].ncgs += 1;
    else if (cat.includes("NC")) map[k].ncs += 1;
  }
  return Object.entries(map)
    .map(([analista, d]) => ({
      analista,
      volume: d.count,
      media: d.sum / d.count,
      nota100: d.nota100,
      ncs: d.ncs,
      ncgs: d.ncgs,
      caixas: [...d.caixas],
    }))
    .sort((a, b) => b.volume - a.volume);
}

export interface KpiDetalhadoData extends KpiData {
  notaMaxima: number;
  pctNC: number;
  pctNCG: number;
}

export function calcKpisDetalhado(avaliacoes: Avaliacao[]): KpiDetalhadoData {
  const base = calcKpis(avaliacoes);
  const notaMaxima = avaliacoes.length > 0 ? Math.max(...avaliacoes.map((a) => a.nota)) : 0;
  return {
    ...base,
    notaMaxima,
    pctNC: base.total > 0 ? (base.ncs / base.total) * 100 : 0,
    pctNCG: base.total > 0 ? (base.ncgs / base.total) * 100 : 0,
  };
}

export interface AnalistaCicloData {
  analista: string;
  ciclos: Record<number, { sum: number; count: number }>;
}

export function byAnalistaCiclo(avaliacoes: Avaliacao[]): AnalistaCicloData[] {
  const map: Record<string, AnalistaCicloData> = {};
  for (const a of avaliacoes) {
    const k = a.analista || "Desconhecido";
    if (!map[k]) map[k] = { analista: k, ciclos: {} };
    const c = a.ciclo || 0;
    if (!map[k].ciclos[c]) map[k].ciclos[c] = { sum: 0, count: 0 };
    map[k].ciclos[c].sum += a.nota;
    map[k].ciclos[c].count += 1;
  }
  return Object.values(map).sort((a, b) => a.analista.localeCompare(b.analista));
}

export interface CausaRaizRecord {
  causaRaiz: string;
  analista: string;
  ciclo: number;
  assunto: string;
  peso: number;
  mediaAnalista: number;
  mes: string;
  caixa: string;
}

export function getCausaRaiz(avaliacoes: Avaliacao[]): CausaRaizRecord[] {
  return avaliacoes
    .filter((a) => a.nota < 100 && a.desvio)
    .map((a) => {
      // calc media do analista no período
      const same = avaliacoes.filter((x) => x.analista === a.analista);
      const media = same.reduce((s, x) => s + x.nota, 0) / (same.length || 1);
      return {
        causaRaiz: a.desvio || "–",
        analista: a.analista,
        ciclo: a.ciclo || 0,
        assunto: a.caixa || "–",
        peso: a.nota,
        mediaAnalista: media,
        mes: a.mes,
        caixa: a.caixa,
      };
    });
}

export interface OfensorData {
  causaRaiz: string;
  total: number;
}

export function byOfensor(avaliacoes: Avaliacao[]): OfensorData[] {
  const map: Record<string, number> = {};
  for (const a of avaliacoes) {
    if (a.nota < 100 && a.desvio) {
      const k = a.desvio.substring(0, 40);
      map[k] = (map[k] || 0) + 1;
    }
  }
  return Object.entries(map)
    .map(([causaRaiz, total]) => ({ causaRaiz, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

export function statusBadge(media: number): { label: string; cls: string } {
  if (media >= 100) return { label: "✓ Meta", cls: "badge-meta" };
  if (media >= 97) return { label: "↑ Atenção", cls: "badge-atencao" };
  return { label: "⚠ Abaixo", cls: "badge-abaixo" };
}

export function mediaColor(media: number): string {
  if (media >= 100) return "#00D664";
  if (media >= 97) return "#00A4E0";
  if (media >= 94) return "#F59E0B";
  return "#EF4444";
}
