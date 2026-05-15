// @ts-ignore
import pptxgen from "pptxgenjs";
import type { KpiData, MesData, CicloData, CaixaData, AnalistaData } from "./firestore";
import { statusBadge } from "./firestore";

const C = {
  dark: "1B2A4A",
  blue: "2563EB",
  accent: "F59E0B",
  green: "10B981",
  red: "EF4444",
  white: "FFFFFF",
  gray: "64748B",
  lgray: "E2E8F0",
  text: "1E293B",
  light: "EFF6FF",
};

function contentSlide(pres: any, title: string) {
  const s = pres.addSlide();
  s.background = { color: C.white };
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.6, fill: { color: C.dark } });
  s.addText(title, { x: 0.3, y: 0, w: 9.4, h: 0.6, fontSize: 15, bold: true, color: C.white, fontFace: "Calibri", valign: "middle" });
  return s;
}

function kpi(s: any, x: number, y: number, w: number, h: number, label: string, val: string, sub: string) {
  s.addShape("rect", { x, y, w, h, fill: { color: C.light } });
  s.addText(label, { x: x + 0.08, y: y + 0.08, w: w - 0.16, h: 0.28, fontSize: 9, color: C.gray, fontFace: "Calibri", align: "center" });
  s.addText(val, { x: x + 0.05, y: y + 0.35, w: w - 0.1, h: 0.5, fontSize: 22, bold: true, color: C.dark, fontFace: "Calibri", align: "center" });
  if (sub) s.addText(sub, { x: x + 0.05, y: y + 0.82, w: w - 0.1, h: 0.22, fontSize: 9, color: C.gray, fontFace: "Calibri", align: "center" });
}

export async function generatePPT(
  periodo: string,
  kpis: KpiData,
  meses: MesData[],
  ciclos: CicloData[],
  caixas: CaixaData[],
  analistas: AnalistaData[],
  causaRaiz?: any[]
) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.title = "Reunião de Melhorias – Monitorias Cielo";

  // ── CAPA ──
  const capa = pres.addSlide();
  capa.background = { color: C.dark };
  capa.addShape(pres.ShapeType?.rect || "rect", { x: 0, y: 4.5, w: 10, h: 1.125, fill: { color: C.blue } });
  capa.addShape(pres.ShapeType?.rect || "rect", { x: 0, y: 0, w: 0.18, h: 5.625, fill: { color: C.accent } });
  capa.addText("REUNIÃO DE MELHORIAS", { x: 0.4, y: 1.0, w: 9.2, h: 0.7, fontSize: 32, bold: true, color: C.white, fontFace: "Calibri" });
  capa.addText("Monitorias Cielo | Análise de Qualidade", { x: 0.4, y: 1.8, w: 9.2, h: 0.5, fontSize: 18, color: "BFDBFE", fontFace: "Calibri" });
  capa.addText(`Período: ${periodo}`, { x: 0.4, y: 2.5, w: 9.2, h: 0.4, fontSize: 13, color: "93C5FD", fontFace: "Calibri" });
  capa.addText(`Total de avaliações: ${kpis.total}  •  Média geral: ${kpis.media.toFixed(2).replace(".", ",")}`, { x: 0.4, y: 3.1, w: 9.2, h: 0.4, fontSize: 13, color: "CBD5E1", fontFace: "Calibri" });
  capa.addText("Gestão de Qualidade", { x: 0.4, y: 4.62, w: 9.2, h: 0.35, fontSize: 11, color: C.white, fontFace: "Calibri" });

  // ── KPIs GERAIS ──
  const sKpi = contentSlide(pres, "Visão Geral – KPIs");
  kpi(sKpi, 0.3, 0.75, 1.9, 1.2, "TOTAL AVALIAÇÕES", String(kpis.total), "registros");
  kpi(sKpi, 2.4, 0.75, 1.9, 1.2, "MÉDIA GERAL", kpis.media.toFixed(2).replace(".", ","), "pontos");
  kpi(sKpi, 4.5, 0.75, 1.9, 1.2, "NOTA 100", String(kpis.nota100), `${kpis.pctMeta.toFixed(1)}% do total`);
  kpi(sKpi, 6.6, 0.75, 1.5, 1.2, "NCs", String(kpis.ncs), "não conformidades");
  kpi(sKpi, 8.3, 0.75, 1.5, 1.2, "NCGs", String(kpis.ncgs), "não conf. graves");

  // ── POR MÊS ──
  if (meses.length > 0) {
    const sMes = contentSlide(pres, "Desempenho por Mês");
    const labels = meses.map((m) => m.mes);
    const volumes = meses.map((m) => m.volume);
    const medias = meses.map((m) => parseFloat(m.media.toFixed(2)));
    sMes.addChart(pres.ChartType?.bar || "bar", [{ name: "Volume", labels, values: volumes }], {
      x: 0.3, y: 0.8, w: 4.5, h: 4.5, barDir: "col",
      showTitle: true, title: "Volume por Mês", showValue: true,
      chartColors: ["2563EB"], showLegend: false,
    });
    sMes.addChart(pres.ChartType?.bar || "bar", [{ name: "Média", labels, values: medias }], {
      x: 5.2, y: 0.8, w: 4.5, h: 4.5, barDir: "col",
      showTitle: true, title: "Média por Mês", showValue: true,
      chartColors: ["10B981"], showLegend: false,
    });
  }

  // ── POR CICLO ──
  if (ciclos.length > 0) {
    const sCiclo = contentSlide(pres, "Desempenho por Ciclo");
    const labels = ciclos.map((c) => `${c.ciclo}° Ciclo`);
    sCiclo.addChart(pres.ChartType?.bar || "bar",
      [
        { name: "Volume", labels, values: ciclos.map((c) => c.volume) },
        { name: "Média", labels, values: ciclos.map((c) => parseFloat(c.media.toFixed(2))) },
      ],
      { x: 0.5, y: 0.8, w: 9, h: 4.5, barDir: "col", showTitle: true, title: "Volume e Média por Ciclo", showLegend: true, chartColors: ["2563EB", "10B981"] }
    );
  }

  // ── POR CAIXA ──
  for (const cx of caixas) {
    const sCx = contentSlide(pres, `Caixa: ${cx.caixa}`);
    kpi(sCx, 0.3, 0.75, 2.1, 1.1, "VOLUME", String(cx.volume), "avaliações");
    kpi(sCx, 2.6, 0.75, 2.1, 1.1, "MÉDIA", cx.media.toFixed(2).replace(".", ","), "pontos");
    kpi(sCx, 4.9, 0.75, 1.6, 1.1, "NOTA 100", String(cx.nota100), `${((cx.nota100/cx.volume)*100).toFixed(0)}%`);
    kpi(sCx, 6.7, 0.75, 1.3, 1.1, "NCs", String(cx.ncs), "");
    kpi(sCx, 8.2, 0.75, 1.5, 1.1, "NCGs", String(cx.ncgs), "");
  }

  // ── POR ANALISTA ──
  const sAn = contentSlide(pres, "Desempenho por Analista");
  const rows: any[] = [
    [
      { text: "Analista", options: { bold: true, color: C.white, fill: { color: C.dark }, fontSize: 10 } },
      { text: "Volume", options: { bold: true, color: C.white, fill: { color: C.dark }, fontSize: 10 } },
      { text: "Média", options: { bold: true, color: C.white, fill: { color: C.dark }, fontSize: 10 } },
      { text: "Nota 100", options: { bold: true, color: C.white, fill: { color: C.dark }, fontSize: 10 } },
      { text: "NCs", options: { bold: true, color: C.white, fill: { color: C.dark }, fontSize: 10 } },
      { text: "Status", options: { bold: true, color: C.white, fill: { color: C.dark }, fontSize: 10 } },
    ],
    ...analistas.slice(0, 15).map((a, i) => {
      const bg = i % 2 === 0 ? "F8FAFF" : "FFFFFF";
      const { label } = statusBadge(a.media);
      const mColor = a.media >= 100 ? "059669" : a.media >= 97 ? "1D4ED8" : "DC2626";
      return [
        { text: a.analista, options: { fill: { color: bg }, fontSize: 9, color: C.text, align: "left" } },
        { text: String(a.volume), options: { fill: { color: bg }, fontSize: 9, color: C.text, align: "center" } },
        { text: a.media.toFixed(2).replace(".", ","), options: { fill: { color: bg }, fontSize: 9, bold: true, color: mColor, align: "center" } },
        { text: String(a.nota100), options: { fill: { color: bg }, fontSize: 9, color: C.text, align: "center" } },
        { text: String(a.ncs), options: { fill: { color: bg }, fontSize: 9, color: C.text, align: "center" } },
        { text: label, options: { fill: { color: bg }, fontSize: 9, color: mColor, align: "center" } },
      ];
    }),
  ];
  sAn.addTable(rows, {
    x: 0.3, y: 0.75, w: 9.4, h: 4.6,
    colW: [3.5, 1.0, 1.1, 1.1, 0.9, 1.8],
    border: { pt: 0.5, color: C.lgray },
    fontFace: "Calibri",
    valign: "middle",
  });

  pres.writeFile({ fileName: `Monitorias_Cielo_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.pptx` });
}
