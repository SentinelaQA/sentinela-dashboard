import { useEffect, useState, useMemo } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import {
  fetchAvaliacoes,
  calcKpis, calcKpisDetalhado, byMes, byCiclo, byCaixa, byAnalista,
  byAnalistaCiclo, getCausaRaiz, byOfensor,
  getMeses, getCaixas, getAnalistas,
  statusBadge, mediaColor,
  type Avaliacao,
} from "../lib/firestore";
import { generatePPT } from "../lib/pptExport";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from "recharts";

type Tab = "geral" | "caixa" | "analistas" | "apontamentos" | "ofensores";

const CAIXA_ABREV: Record<string, string> = {
  "Consultoria Agenda Financeira": "CAF",
  "Gestão Aluguel Estorno": "GAE",
  "Gestão Aluguel Incentivo": "GAI",
  "Processos Ouvidoria BO": "PO-BO",
  "Regularizações Financeiras": "RF",
  "Backoffice Mídias Sociais": "BMS",
  "Prévia MDR": "PMDR",
  "Estorno MDR": "EMDR",
};
const abrev = (cx: string) => CAIXA_ABREV[cx] || cx.split(" ").slice(0, 2).join(" ");
const fmt = (n: number, d = 2) => n.toFixed(d).replace(".", ",");

const CICLO_COLORS = ["#00A4E0", "#00D664", "#F59E0B", "#A855F7"];

function KpiBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card p-5 card-hover text-center">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{label}</div>
      <div className="text-3xl font-extrabold" style={{ color: color || "#e2e8f0" }}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function KpiPill({ label, value, vol, color }: { label: string; value: string; vol: string; color: string }) {
  return (
    <div className="rounded-xl p-4 text-center border" style={{ background: "rgba(255,255,255,0.04)", borderColor: color + "44" }}>
      <div className="text-xs font-bold text-slate-400 uppercase mb-1">{label}</div>
      <div className="text-2xl font-extrabold" style={{ color }}>{value}</div>
      <div className="text-xs text-slate-500">{vol}</div>
    </div>
  );
}

function Badge({ media }: { media: number }) {
  const { label, cls } = statusBadge(media);
  return <span className={`${cls} text-xs font-semibold px-2 py-0.5 rounded-full`}>{label}</span>;
}

export default function Dashboard() {
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("geral");
  const [generatingPPT, setGeneratingPPT] = useState(false);
  const [filtroMes, setFiltroMes] = useState("Todos");
  const [filtroCaixa, setFiltroCaixa] = useState("Todas");
  const [filtroAnalista, setFiltroAnalista] = useState("Todos");
  const [caixaDetalhe, setCaixaDetalhe] = useState("");

  useEffect(() => {
    fetchAvaliacoes()
      .then((data) => { setAvaliacoes(data); if (data.length > 0) { const caixas = [...new Set(data.map(a => a.caixa))].filter(Boolean); setCaixaDetalhe(caixas[0] || ""); } })
      .catch(() => setError("Erro ao carregar dados do Firebase."))
      .finally(() => setLoading(false));
  }, []);

  const mesesDisponiveis = useMemo(() => getMeses(avaliacoes), [avaliacoes]);
  const caixasDisponiveis = useMemo(() => getCaixas(avaliacoes), [avaliacoes]);
  const analistasDisponiveis = useMemo(() => getAnalistas(avaliacoes), [avaliacoes]);

  const filtered = useMemo(() => avaliacoes.filter((a) => {
    if (filtroMes !== "Todos" && a.mes !== filtroMes) return false;
    if (filtroCaixa !== "Todas" && a.caixa !== filtroCaixa) return false;
    if (filtroAnalista !== "Todos" && a.analista !== filtroAnalista) return false;
    return true;
  }), [avaliacoes, filtroMes, filtroCaixa, filtroAnalista]);

  const kpis = useMemo(() => calcKpisDetalhado(filtered), [filtered]);
  const mesDados = useMemo(() => byMes(filtered), [filtered]);
  const cicloDados = useMemo(() => byCiclo(filtered), [filtered]);
  const caixaDados = useMemo(() => byCaixa(filtered), [filtered]);
  const analistaDados = useMemo(() => byAnalista(filtered), [filtered]);
  const causaRaizDados = useMemo(() => getCausaRaiz(filtered), [filtered]);
  const ofensorDados = useMemo(() => byOfensor(filtered), [filtered]);

  // Per-caixa detalhe
  const caixaFiltrada = useMemo(() => filtered.filter(a => a.caixa === caixaDetalhe), [filtered, caixaDetalhe]);
  const kpisCaixa = useMemo(() => calcKpisDetalhado(caixaFiltrada), [caixaFiltrada]);
  const cicloCaixa = useMemo(() => byCiclo(caixaFiltrada), [caixaFiltrada]);
  const analistaCicloCaixa = useMemo(() => byAnalistaCiclo(caixaFiltrada), [caixaFiltrada]);
  const analistaCaixaDados = useMemo(() => byAnalista(caixaFiltrada), [caixaFiltrada]);
  const causaRaizCaixa = useMemo(() => getCausaRaiz(caixaFiltrada), [caixaFiltrada]);

  // Analista-ciclo chart data for grouped bars
  const analistaCicloChartData = useMemo(() => {
    return analistaCicloCaixa.map((a) => {
      const row: Record<string, any> = { analista: a.analista.split(" ")[0] };
      [1, 2, 3, 4].forEach((c) => {
        const d = a.ciclos[c];
        row[`${c}°`] = d ? parseFloat((d.sum / d.count).toFixed(2)) : null;
      });
      return row;
    });
  }, [analistaCicloCaixa]);

  // "Trimestre por Célula" – media por caixa por mes
  const trimCelulaData = useMemo(() => {
    const meses = mesesDisponiveis.slice(-3);
    return caixasDisponiveis.map((cx) => {
      const row: Record<string, any> = { caixa: abrev(cx) };
      meses.forEach((m) => {
        const av = filtered.filter(a => a.caixa === cx && a.mes === m);
        row[m] = av.length > 0 ? parseFloat((av.reduce((s, a) => s + a.nota, 0) / av.length).toFixed(2)) : null;
      });
      return row;
    });
  }, [filtered, caixasDisponiveis, mesesDisponiveis]);

  const mesesRecentes = mesesDisponiveis.slice(-3);
  const periodoLabel = filtroMes !== "Todos" ? filtroMes : mesesDisponiveis.length > 0 ? `${mesesDisponiveis[0]} – ${mesesDisponiveis[mesesDisponiveis.length - 1]}` : "–";

  async function handleExportPPT() {
    setGeneratingPPT(true);
    try {
      await generatePPT(periodoLabel, kpis, mesDados, cicloDados, caixaDados, analistaDados, causaRaizDados);
    } catch (e) { console.error(e); }
    finally { setGeneratingPPT(false); }
  }

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "geral", label: "Visão Geral", icon: "📊" },
    { id: "caixa", label: "Por Caixa", icon: "📦" },
    { id: "analistas", label: "Analistas", icon: "👤" },
    { id: "apontamentos", label: "NCs & Apontamentos", icon: "⚠️" },
    { id: "ofensores", label: "Ofensores", icon: "🔍" },
  ];

  if (loading) return <div className="min-h-screen flex items-center justify-center flex-col gap-4"><div className="w-10 h-10 rounded-full border-4 border-navy-600 border-t-brand-blue animate-spin" /><p className="text-slate-400 text-sm">Carregando monitorias...</p></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center"><div className="card p-8 text-center max-w-sm"><div className="text-4xl mb-3">⚠️</div><p className="text-red-400 font-semibold">{error}</p><button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#00A4E0" }}>Tentar novamente</button></div></div>;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="card sticky top-0 z-50 rounded-none border-x-0 border-t-0 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold text-white" style={{ background: "linear-gradient(135deg,#00A4E0,#00D664)" }}>✓</div>
          <div>
            <h1 className="text-base font-extrabold gradient-text leading-tight">Dashboard de Qualidade</h1>
            <p className="text-xs text-slate-500">Monitorias Cielo · {periodoLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExportPPT} disabled={generatingPPT || filtered.length === 0} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50" style={{ background: "linear-gradient(135deg,#00A4E0,#00C85A)" }}>
            {generatingPPT ? "⏳ Gerando..." : "📊 Exportar PPT"}
          </button>
          <button onClick={() => signOut(auth)} className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white border border-navy-600">Sair</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Filters */}
        <div className="card p-4 flex flex-wrap gap-3 items-center">
          <span className="text-xs font-semibold text-slate-400 uppercase">Filtros:</span>
          {[
            { label: "Mês", value: filtroMes, set: setFiltroMes, opts: ["Todos", ...mesesDisponiveis] },
            { label: "Caixa", value: filtroCaixa, set: setFiltroCaixa, opts: ["Todas", ...caixasDisponiveis] },
            { label: "Analista", value: filtroAnalista, set: setFiltroAnalista, opts: ["Todos", ...analistasDisponiveis] },
          ].map(({ label, value, set, opts }) => (
            <select key={label} value={value} onChange={(e) => set(e.target.value)} className="text-sm rounded-lg px-3 py-1.5 text-slate-300 outline-none" style={{ background: "#1a1f2e", border: "1.5px solid #3a4256" }}>
              {opts.map((o) => <option key={o}>{o}</option>)}
            </select>
          ))}
          {(filtroMes !== "Todos" || filtroCaixa !== "Todas" || filtroAnalista !== "Todos") && (
            <button onClick={() => { setFiltroMes("Todos"); setFiltroCaixa("Todas"); setFiltroAnalista("Todos"); }} className="text-xs text-slate-400 hover:text-red-400">✕ Limpar</button>
          )}
          <span className="ml-auto text-xs text-slate-500">{filtered.length} avaliações</span>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiBox label="Total" value={String(kpis.total)} sub="avaliações" />
          <KpiBox label="Média Geral" value={fmt(kpis.media)} color={mediaColor(kpis.media)} />
          <KpiBox label="Nota Máxima" value={`${fmt(kpis.pctMeta, 1)}%`} sub={`${kpis.nota100} registros`} color="#00D664" />
          <KpiBox label="% Nota 100" value={`${fmt(kpis.pctMeta, 1)}%`} color="#00D664" />
          <KpiBox label="NCs" value={`${fmt(kpis.pctNC, 1)}%`} sub={`${kpis.ncs} registros`} color="#F59E0B" />
          <KpiBox label="NCGs" value={`${fmt(kpis.pctNCG, 1)}%`} sub={`${kpis.ncgs} registros`} color="#EF4444" />
        </div>

        {/* Tabs */}
        <div className="card overflow-hidden">
          <div className="flex border-b border-navy-600 px-1 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${tab === t.id ? "tab-active" : "text-slate-400 hover:text-slate-200"}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div className="p-5">

            {/* ── VISÃO GERAL ── */}
            {tab === "geral" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Qualidade Trimestral */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-300 mb-3">Qualidade Trimestral</h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={mesDados} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2d3548" />
                        <XAxis dataKey="mes" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                        <YAxis domain={[80, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: "#242b3d", border: "1px solid #3a4256", borderRadius: 8 }} formatter={(v: any) => [fmt(v), "Média"]} />
                        <Bar dataKey="media" radius={[4, 4, 0, 0]} name="Média">
                          {mesDados.map((_, i) => <Cell key={i} fill={CICLO_COLORS[i % CICLO_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-2 space-y-1">
                      {mesDados.map((m) => (
                        <div key={m.mes} className="flex justify-between text-xs text-slate-400">
                          <span>{m.mes}</span><span className="font-bold" style={{ color: mediaColor(m.media) }}>{fmt(m.media)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Trimestre por Célula */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-300 mb-3">Trimestre por Célula</h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={trimCelulaData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2d3548" />
                        <XAxis dataKey="caixa" tick={{ fill: "#94a3b8", fontSize: 9 }} />
                        <YAxis domain={[70, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: "#242b3d", border: "1px solid #3a4256", borderRadius: 8 }} formatter={(v: any) => [fmt(v), ""]} />
                        <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 11 }} />
                        {mesesRecentes.map((m, i) => (
                          <Bar key={m} dataKey={m} fill={CICLO_COLORS[i]} radius={[3, 3, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Volume por Ciclo */}
                <div>
                  <h3 className="text-sm font-bold text-slate-300 mb-3">Volume e Média por Ciclo</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {cicloDados.map((c) => (
                      <div key={c.ciclo} className="card p-4 text-center">
                        <div className="text-xs text-slate-400 mb-1">{c.ciclo}° CICLO</div>
                        <div className="text-2xl font-extrabold" style={{ color: mediaColor(c.media) }}>{fmt(c.media)}</div>
                        <div className="text-xs text-slate-500">{c.volume} avaliações</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── POR CAIXA ── */}
            {tab === "caixa" && (
              <div className="space-y-5">
                {/* Caixa selector */}
                <div className="flex flex-wrap gap-2">
                  {caixasDisponiveis.map((cx) => (
                    <button key={cx} onClick={() => setCaixaDetalhe(cx)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${caixaDetalhe === cx ? "text-white border-brand-blue" : "text-slate-400 border-navy-600 hover:border-slate-500"}`} style={caixaDetalhe === cx ? { background: "#00A4E0" } : {}}>
                      {abrev(cx)}
                    </button>
                  ))}
                </div>

                {caixaDetalhe && (
                  <>
                    <h3 className="text-base font-bold text-slate-200">{caixaDetalhe}</h3>

                    {/* KPI pills */}
                    <div className="grid grid-cols-3 gap-3">
                      <KpiPill label="Nota Máxima" value={`${fmt(kpisCaixa.pctMeta, 0)}%`} vol={`Vol. (${kpisCaixa.total})`} color="#00D664" />
                      <KpiPill label="NC" value={`${fmt(kpisCaixa.pctNC, 0)}%`} vol={`Vol. (${kpisCaixa.ncs})`} color="#F59E0B" />
                      <KpiPill label="NCG" value={`${fmt(kpisCaixa.pctNCG, 0)}%`} vol={`Vol. (${kpisCaixa.ncgs})`} color="#EF4444" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                      {/* Caixas Avaliadas | Mês – bar por analista */}
                      <div className="lg:col-span-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Caixas Avaliadas | Mês</h4>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={analistaCaixaDados.map(a => ({ nome: a.analista.split(" ")[0], volume: a.volume, media: parseFloat(a.media.toFixed(2)) }))} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2d3548" />
                            <XAxis dataKey="nome" tick={{ fill: "#94a3b8", fontSize: 9 }} />
                            <YAxis yAxisId="v" orientation="left" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                            <YAxis yAxisId="m" orientation="right" domain={[70, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                            <Tooltip contentStyle={{ background: "#242b3d", border: "1px solid #3a4256", borderRadius: 8 }} />
                            <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 11 }} />
                            <Bar yAxisId="v" dataKey="volume" fill="#00A4E0" radius={[3, 3, 0, 0]} name="Volume" />
                            <Bar yAxisId="m" dataKey="media" fill="#00D664" radius={[3, 3, 0, 0]} name="Média" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Média Ciclo table */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Média Ciclo</h4>
                        <table className="w-full text-sm">
                          <thead><tr className="border-b border-navy-600"><th className="text-left py-1.5 px-2 text-xs text-slate-400">Ciclo</th><th className="text-right py-1.5 px-2 text-xs text-slate-400">Nota</th><th className="text-right py-1.5 px-2 text-xs text-slate-400">Vol.</th></tr></thead>
                          <tbody>
                            {cicloCaixa.map((c) => (
                              <tr key={c.ciclo} className="border-b border-navy-600/40">
                                <td className="py-1.5 px-2 text-slate-300">{c.ciclo}° Ciclo</td>
                                <td className="py-1.5 px-2 text-right font-bold" style={{ color: mediaColor(c.media) }}>{fmt(c.media)}</td>
                                <td className="py-1.5 px-2 text-right text-slate-400">{c.volume}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Acompanhamento por Analista – Ciclo (grouped bars) */}
                    {analistaCicloChartData.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Acompanhamento por Analista – Ciclo</h4>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={analistaCicloChartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2d3548" />
                            <XAxis dataKey="analista" tick={{ fill: "#94a3b8", fontSize: 9 }} />
                            <YAxis domain={[70, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                            <Tooltip contentStyle={{ background: "#242b3d", border: "1px solid #3a4256", borderRadius: 8 }} formatter={(v: any) => [fmt(v), ""]} />
                            <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 11 }} />
                            {[1, 2, 3, 4].map((c, i) => (
                              <Bar key={c} dataKey={`${c}°`} fill={CICLO_COLORS[i]} radius={[2, 2, 0, 0]} name={`${c}° Ciclo`} />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Causa Raiz table */}
                    {causaRaizCaixa.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Causa Raiz</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead><tr className="border-b border-navy-600 text-slate-400">
                              {["Causa Raiz", "Analista", "Ciclo", "Assunto", "Peso", "Média Analista", "Mês"].map(h => <th key={h} className="text-left py-2 px-2 font-semibold uppercase">{h}</th>)}
                            </tr></thead>
                            <tbody>
                              {causaRaizCaixa.slice(0, 20).map((r, i) => (
                                <tr key={i} className="border-b border-navy-600/40 hover:bg-navy-700/30">
                                  <td className="py-1.5 px-2 text-slate-300 max-w-xs truncate">{r.causaRaiz}</td>
                                  <td className="py-1.5 px-2 text-slate-300 whitespace-nowrap">{r.analista.split(" ").slice(0, 2).join(" ")}</td>
                                  <td className="py-1.5 px-2 text-slate-400 text-center">{r.ciclo}°</td>
                                  <td className="py-1.5 px-2 text-slate-400">{abrev(r.assunto)}</td>
                                  <td className="py-1.5 px-2 text-center font-bold" style={{ color: mediaColor(r.peso) }}>{r.peso}</td>
                                  <td className="py-1.5 px-2 text-center font-bold" style={{ color: mediaColor(r.mediaAnalista) }}>{fmt(r.mediaAnalista)}</td>
                                  <td className="py-1.5 px-2 text-slate-500">{r.mes}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── ANALISTAS ── */}
            {tab === "analistas" && (
              <div className="space-y-5">
                <h3 className="text-sm font-bold text-slate-300">Acompanhamento Monitorias por Analista | 100%</h3>
                {caixasDisponiveis.map((cx) => {
                  const avCx = filtered.filter(a => a.caixa === cx);
                  const anCx = byAnalista(avCx);
                  if (anCx.length === 0) return null;
                  return (
                    <div key={cx}>
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Monitoria | {abrev(cx)}</h4>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={anCx.map(a => ({ nome: a.analista.split(" ")[0], pct100: parseFloat(((a.nota100 / a.volume) * 100).toFixed(1)), media: parseFloat(a.media.toFixed(2)) }))} margin={{ top: 0, right: 10, left: -15, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2d3548" />
                          <XAxis dataKey="nome" tick={{ fill: "#94a3b8", fontSize: 9 }} />
                          <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                          <Tooltip contentStyle={{ background: "#242b3d", border: "1px solid #3a4256", borderRadius: 8 }} formatter={(v: any) => [`${v}%`, "% Nota 100"]} />
                          <Bar dataKey="pct100" radius={[3, 3, 0, 0]} name="% Nota 100">
                            {anCx.map((a, i) => <Cell key={i} fill={a.media >= 100 ? "#00D664" : a.media >= 97 ? "#00A4E0" : "#F59E0B"} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── APONTAMENTOS ── */}
            {tab === "apontamentos" && (
              <div className="space-y-6">
                {caixaDados.map((cx) => {
                  const kpicx = calcKpisDetalhado(filtered.filter(a => a.caixa === cx.caixa));
                  const crCx = causaRaizDados.filter(r => r.caixa === cx.caixa);
                  return (
                    <div key={cx.caixa} className="card p-4 space-y-3">
                      <h3 className="text-sm font-bold text-slate-200">{cx.caixa}</h3>
                      <div className="grid grid-cols-3 gap-3">
                        <KpiPill label="Nota Máxima" value={`${fmt(kpicx.pctMeta, 0)}%`} vol={`Vol. (${kpicx.total})`} color="#00D664" />
                        <KpiPill label="NC" value={`${fmt(kpicx.pctNC, 0)}%`} vol={`Vol. (${kpicx.ncs})`} color="#F59E0B" />
                        <KpiPill label="NCG" value={`${fmt(kpicx.pctNCG, 0)}%`} vol={`Vol. (${kpicx.ncgs})`} color="#EF4444" />
                      </div>
                      {crCx.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead><tr className="border-b border-navy-600 text-slate-400">{["Causa Raiz", "Analista", "Ciclo", "Assunto", "Peso", "Média", "Mês"].map(h => <th key={h} className="text-left py-1.5 px-2 font-semibold uppercase">{h}</th>)}</tr></thead>
                            <tbody>
                              {crCx.slice(0, 8).map((r, i) => (
                                <tr key={i} className="border-b border-navy-600/40">
                                  <td className="py-1.5 px-2 text-slate-300 max-w-xs truncate">{r.causaRaiz}</td>
                                  <td className="py-1.5 px-2 whitespace-nowrap text-slate-300">{r.analista.split(" ").slice(0, 2).join(" ")}</td>
                                  <td className="py-1.5 px-2 text-center text-slate-400">{r.ciclo}°</td>
                                  <td className="py-1.5 px-2 text-slate-400">{abrev(r.assunto)}</td>
                                  <td className="py-1.5 px-2 text-center font-bold" style={{ color: mediaColor(r.peso) }}>{r.peso}</td>
                                  <td className="py-1.5 px-2 text-center font-bold" style={{ color: mediaColor(r.mediaAnalista) }}>{fmt(r.mediaAnalista)}</td>
                                  <td className="py-1.5 px-2 text-slate-500">{r.mes}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── OFENSORES ── */}
            {tab === "ofensores" && (
              <div className="space-y-5">
                <h3 className="text-sm font-bold text-slate-300">Ofensor Trimestre</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={ofensorDados} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d3548" />
                    <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <YAxis type="category" dataKey="causaRaiz" tick={{ fill: "#94a3b8", fontSize: 10 }} width={160} />
                    <Tooltip contentStyle={{ background: "#242b3d", border: "1px solid #3a4256", borderRadius: 8 }} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]} name="Ocorrências">
                      {ofensorDados.map((_, i) => <Cell key={i} fill={CICLO_COLORS[i % CICLO_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-navy-600">{["Causa Raiz", "Total", "% do Total"].map(h => <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-slate-400 uppercase">{h}</th>)}</tr></thead>
                    <tbody>
                      {ofensorDados.map((o, i) => (
                        <tr key={i} className="border-b border-navy-600/50 hover:bg-navy-700/30">
                          <td className="py-2 px-3 text-slate-200">{o.causaRaiz}</td>
                          <td className="py-2 px-3 text-slate-300">{o.total}</td>
                          <td className="py-2 px-3 text-slate-400">{fmt((o.total / (causaRaizDados.length || 1)) * 100, 1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="text-center text-xs text-slate-600 pb-4">
          Dashboard de Qualidade · Monitorias Cielo · Dados em tempo real via Firebase
        </div>
      </div>
    </div>
  );
}
