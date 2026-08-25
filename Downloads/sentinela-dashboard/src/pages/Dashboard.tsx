import { useEffect, useState, useMemo } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import {
  fetchAvaliacoes, calcKpisDetalhado, byMes, byCiclo, byAnalista,
  getCausaRaiz, getMeses, statusBadge, mediaColor,
  type Avaliacao,
} from "../lib/firestore";
import { normCaixa, abrevCaixa } from "../lib/processos";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ComposedChart, Line, LabelList,
} from "recharts";

const MESES_ORDEM = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const CORES_MES = ["#1B2A4A","#00A4E0","#9CA3AF","#00D664","#F59E0B"];

// ── Processos e caixas ──────────────────────────────────────────
const AGENDA_FINANCEIRA_CAIXAS = [
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
];

const SUPORTE_CAIXAS = ["Suporte Conciliação"];

const fmt = (n: number, d = 2) => isNaN(n) ? "—" : n.toFixed(d).replace(".", ",");
const pct = (n: number) => `${Math.round(n)}%`;

// ── Componentes visuais ─────────────────────────────────────────
function KpiCard({ label, val, sub, color = "#e2e8f0" }: { label: string; val: string; sub?: string; color?: string }) {
  return (
    <div className="card p-5 text-center card-hover">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-3xl font-extrabold" style={{ color }}>{val}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function KpiPill({ label, val, vol, color }: { label: string; val: string; vol: string; color: string }) {
  return (
    <div className="rounded-2xl p-4 text-center border" style={{ background: color + "18", borderColor: color + "55" }}>
      <p className="text-xs font-bold text-slate-400 uppercase mb-1">{label}</p>
      <p className="text-2xl font-extrabold" style={{ color }}>{val}</p>
      <p className="text-xs text-slate-500 mt-0.5">{vol}</p>
    </div>
  );
}

function ChartVolNota({ data }: { data: { label: string; volume: number; nota: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 22, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2d3548" />
        <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <YAxis yAxisId="v" orientation="left" tick={{ fill: "#94a3b8", fontSize: 10 }} />
        <YAxis yAxisId="n" orientation="right" domain={[60, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
        <Tooltip contentStyle={{ background: "#1a2030", border: "1px solid #3a4256", borderRadius: 8 }}
          formatter={(v: any, name: string) => [name === "nota" ? fmt(v) : v, name === "nota" ? "Nota" : "Volume"]} />
        <Bar yAxisId="v" dataKey="volume" fill="#00A4E0" radius={[4, 4, 0, 0]} name="volume">
          <LabelList dataKey="volume" position="inside" style={{ fill: "#fff", fontSize: 11, fontWeight: 700 }} />
        </Bar>
        <Line yAxisId="n" type="monotone" dataKey="nota" stroke="#fff" strokeWidth={2}
          strokeDasharray="5 4" dot={{ fill: "#fff", r: 4 }} name="nota">
          <LabelList dataKey="nota" position="top" style={{ fill: "#e2e8f0", fontSize: 11, fontWeight: 700 }}
            formatter={(v: number) => fmt(v)} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function ChartMeses({ data, meses, labelKey }: { data: any[]; meses: string[]; labelKey: string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 22, right: 5, left: -15, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2d3548" />
        <XAxis dataKey={labelKey} tick={{ fill: "#94a3b8", fontSize: 9 }} />
        <YAxis domain={[60, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
        <Tooltip contentStyle={{ background: "#1a2030", border: "1px solid #3a4256", borderRadius: 8 }}
          formatter={(v: any) => [fmt(v), ""]} />
        <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 11 }} />
        {meses.map((m, i) => (
          <Bar key={m} dataKey={m} fill={CORES_MES[i % CORES_MES.length]} radius={[3, 3, 0, 0]}>
            <LabelList dataKey={m} position="top" style={{ fill: "#e2e8f0", fontSize: 9 }}
              formatter={(v: number) => v ? fmt(v, 1) : ""} />
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function TabBar({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex border-b border-navy-600 px-1 overflow-x-auto">
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)}
          className={`px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${active === t ? "tab-active" : "text-slate-400 hover:text-slate-200"}`}>
          {t}
        </button>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processo, setProcesso] = useState<"Agenda Financeira" | "Suporte Conciliação">("Agenda Financeira");
  const [tab, setTab] = useState("Consolidado");
  const [filtroMes, setFiltroMes] = useState("Todos");
  const [filtroAnalista, setFiltroAnalista] = useState("Todos");

  // Caixas selecionadas via checkbox (Agenda Financeira)
  const [caixasSel, setCaixasSel] = useState<Set<string>>(new Set(AGENDA_FINANCEIRA_CAIXAS));

  useEffect(() => {
    fetchAvaliacoes()
      .then((d) => setAvaliacoes(d.map((a) => ({ ...a, caixa: normCaixa(a.caixa) }))))
      .catch(() => setError("Erro ao carregar dados."))
      .finally(() => setLoading(false));
  }, []);

  // Caixas do processo atual
  const caixasProcesso = processo === "Agenda Financeira" ? AGENDA_FINANCEIRA_CAIXAS : SUPORTE_CAIXAS;

  // Toggle checkbox
  function toggleCaixa(cx: string) {
    setCaixasSel((prev) => {
      const next = new Set(prev);
      next.has(cx) ? next.delete(cx) : next.add(cx);
      return next;
    });
  }
  function toggleTodas() {
    if (caixasSel.size === caixasProcesso.length) setCaixasSel(new Set());
    else setCaixasSel(new Set(caixasProcesso));
  }

  // Caixas ativas (interseção selecionadas × existentes no Firebase)
  const caixasAtivas = useMemo(() =>
    processo === "Agenda Financeira"
      ? caixasProcesso.filter((cx) => caixasSel.has(cx))
      : caixasProcesso,
    [processo, caixasSel, caixasProcesso]);

  // Dados do processo filtrado
  const procData = useMemo(() =>
    avaliacoes.filter((a) => caixasProcesso.includes(a.caixa)),
    [avaliacoes, caixasProcesso]);

  const meses = useMemo(() => getMeses(procData), [procData]);
  const analistasProc = useMemo(() =>
    [...new Set(procData.map((a) => a.analista))].filter(Boolean).sort(), [procData]);

  // Dados filtrados por caixas selecionadas + mês + analista
  const filtered = useMemo(() => procData.filter((a) => {
    if (!caixasAtivas.includes(a.caixa)) return false;
    if (filtroMes !== "Todos" && a.mes !== filtroMes) return false;
    if (filtroAnalista !== "Todos" && a.analista !== filtroAnalista) return false;
    return true;
  }), [procData, caixasAtivas, filtroMes, filtroAnalista]);

  const kpis = useMemo(() => calcKpisDetalhado(filtered), [filtered]);
  const mesDados = useMemo(() => byMes(filtered), [filtered]);
  const cicloDados = useMemo(() => byCiclo(filtered), [filtered]);
  const analistaDados = useMemo(() => byAnalista(filtered), [filtered]);
  const causaRaiz = useMemo(() => getCausaRaiz(filtered), [filtered]);

  const mesesRecentes = useMemo(() => meses.slice(-3), [meses]);

  const trimData = useMemo(() =>
    mesDados.slice(-3).map((m) => ({ label: m.mes, volume: m.volume, nota: m.media })),
    [mesDados]);

  const celData = useMemo(() => {
    return caixasAtivas.map((cx) => {
      const row: Record<string, any> = { caixa: abrevCaixa(cx) };
      mesesRecentes.forEach((m) => {
        const av = filtered.filter((a) => a.caixa === cx && a.mes === m);
        row[m] = av.length ? parseFloat((av.reduce((s, a) => s + a.nota, 0) / av.length).toFixed(2)) : null;
      });
      return row;
    });
  }, [filtered, caixasAtivas, mesesRecentes]);

  const caixasAval = useMemo(() => {
    const cx: Record<string, { vol: number; sum: number }> = {};
    filtered.forEach((a) => {
      if (!cx[a.caixa]) cx[a.caixa] = { vol: 0, sum: 0 };
      cx[a.caixa].vol++;
      cx[a.caixa].sum += a.nota;
    });
    return Object.entries(cx).map(([caixa, d]) => ({
      label: abrevCaixa(caixa),
      volume: d.vol,
      nota: d.sum / d.vol,
    })).sort((a, b) => b.volume - a.volume);
  }, [filtered]);

  const ofensorData = useMemo(() => {
    return caixasAtivas.map((cx) => {
      const row: Record<string, any> = { label: abrevCaixa(cx) };
      mesesRecentes.forEach((m) => {
        const av = filtered.filter((a) => a.caixa === cx && a.mes === m);
        row[m] = av.length ? parseFloat((av.reduce((s, a) => s + a.nota, 0) / av.length).toFixed(2)) : null;
      });
      return row;
    });
  }, [filtered, caixasAtivas, mesesRecentes]);

  const an100 = useMemo(() => analistaDados.filter((a) => a.media >= 100), [analistaDados]);
  const anAbaixo = useMemo(() => analistaDados.filter((a) => a.media < 100).sort((a, b) => a.media - b.media), [analistaDados]);

  const quadroCiclo = useMemo(() => {
    const res: Record<number, Set<string>> = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() };
    filtered.forEach((a) => { if (a.ciclo >= 1 && a.ciclo <= 4) res[a.ciclo].add(a.analista); });
    return [1, 2, 3, 4].map((c) => ({ ciclo: c, ativos: res[c].size }));
  }, [filtered]);

  const TABS = ["Consolidado", "Acompanhamento", "Indicadores", "Ofensores", "Analistas 100%"];
  const periodoLabel = filtroMes !== "Todos" ? filtroMes
    : meses.length ? `${meses[0]} – ${meses[meses.length - 1]}` : "–";

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4">
      <div className="w-10 h-10 rounded-full border-4 border-navy-600 border-t-brand-blue animate-spin" />
      <p className="text-slate-400 text-sm">Carregando monitorias...</p>
    </div>
  );
  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card p-8 text-center max-w-sm">
        <p className="text-4xl mb-3">⚠️</p>
        <p className="text-red-400 font-semibold">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#00A4E0" }}>Tentar novamente</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* HEADER */}
      <header className="card sticky top-0 z-50 rounded-none border-x-0 border-t-0 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold text-white"
            style={{ background: "linear-gradient(135deg,#1B2A4A,#00A4E0)" }}>✓</div>
          <div>
            <h1 className="text-base font-extrabold gradient-text leading-tight">Dashboard de Qualidade</h1>
            <p className="text-xs text-slate-500">Monitorias Cielo · {periodoLabel}</p>
          </div>
        </div>
        <button onClick={() => signOut(auth)} className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white border border-navy-600">Sair</button>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">

        {/* PROCESSO SELECTOR */}
        <div className="card p-4 space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-bold text-slate-400 uppercase mr-1">Processo:</span>
            {(["Agenda Financeira", "Suporte Conciliação"] as const).map((p) => (
              <button key={p} onClick={() => { setProcesso(p); setTab("Consolidado"); setFiltroMes("Todos"); setFiltroAnalista("Todos"); if (p === "Suporte Conciliação") setCaixasSel(new Set(SUPORTE_CAIXAS)); else setCaixasSel(new Set(AGENDA_FINANCEIRA_CAIXAS)); }}
                className={`px-5 py-2 rounded-full text-sm font-semibold border transition-all ${processo === p ? "text-white border-transparent" : "text-slate-400 border-navy-600 hover:border-slate-500"}`}
                style={processo === p ? { background: "linear-gradient(135deg,#1B2A4A,#00A4E0)" } : {}}>
                {p}
              </button>
            ))}
          </div>

          {/* CAIXAS CHECKBOXES – só Agenda Financeira */}
          {processo === "Agenda Financeira" && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Caixas:</span>
                <button onClick={toggleTodas} className="text-xs text-brand-blue hover:text-white underline transition-colors">
                  {caixasSel.size === caixasProcesso.length ? "Desmarcar todas" : "Marcar todas"}
                </button>
                <span className="text-xs text-slate-500">{caixasSel.size} de {caixasProcesso.length} selecionadas</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {AGENDA_FINANCEIRA_CAIXAS.map((cx) => {
                  const ativo = caixasSel.has(cx);
                  return (
                    <button key={cx} onClick={() => toggleCaixa(cx)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${ativo ? "text-white border-transparent" : "text-slate-400 border-navy-600 hover:border-slate-500"}`}
                      style={ativo ? { background: "#1B2A4A", borderColor: "#00A4E0" } : {}}>
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${ativo ? "border-blue-400" : "border-slate-600"}`}
                        style={ativo ? { background: "#00A4E0" } : {}}>
                        {ativo && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
                      </span>
                      {abrevCaixa(cx)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* FILTROS */}
        <div className="card p-3 flex flex-wrap gap-3 items-center">
          <span className="text-xs font-semibold text-slate-400 uppercase">Filtros:</span>
          <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}
            className="text-sm rounded-lg px-3 py-1.5 text-slate-300 outline-none"
            style={{ background: "#1a1f2e", border: "1.5px solid #3a4256" }}>
            {["Todos", ...meses].map((o) => <option key={o}>{o}</option>)}
          </select>
          <select value={filtroAnalista} onChange={(e) => setFiltroAnalista(e.target.value)}
            className="text-sm rounded-lg px-3 py-1.5 text-slate-300 outline-none"
            style={{ background: "#1a1f2e", border: "1.5px solid #3a4256" }}>
            {["Todos", ...analistasProc].map((o) => <option key={o}>{o}</option>)}
          </select>
          {(filtroMes !== "Todos" || filtroAnalista !== "Todos") && (
            <button onClick={() => { setFiltroMes("Todos"); setFiltroAnalista("Todos"); }}
              className="text-xs text-slate-400 hover:text-red-400">✕ Limpar</button>
          )}
          <span className="ml-auto text-xs text-slate-500">{filtered.length} avaliações</span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Total" val={String(kpis.total)} sub="avaliações" />
          <KpiCard label="Média Geral" val={fmt(kpis.media)} color={mediaColor(kpis.media)} />
          <KpiCard label="Nota Máxima" val={pct(kpis.pctMeta)} sub={`${kpis.nota100} avaliações`} color="#00D664" />
          <KpiCard label="% Nota 100" val={pct(kpis.pctMeta)} color="#00D664" />
          <KpiCard label="NC" val={pct(kpis.pctNC)} sub={`${kpis.ncs} registros`} color="#F59E0B" />
          <KpiCard label="NCG" val={pct(kpis.pctNCG)} sub={`${kpis.ncgs} registros`} color="#EF4444" />
        </div>

        {/* TABS */}
        <div className="card overflow-hidden">
          <TabBar tabs={TABS} active={tab} onChange={setTab} />
          <div className="p-5">

            {/* CONSOLIDADO */}
            {tab === "Consolidado" && (
              <div className="space-y-6">
                <h2 className="text-base font-bold text-slate-200">
                  Médias de Qualidade | Consolidado {periodoLabel} – {processo}
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-300 mb-3">Qualidade Trimestral</h3>
                    <ChartVolNota data={trimData} />
                    <div className="flex gap-4 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: "#00A4E0" }} />Volume</span>
                      <span className="flex items-center gap-1"><span className="inline-block border-t-2 border-dashed border-white w-6" />Nota</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-300 mb-3">Qualidade Trimestral por Célula</h3>
                    <ChartMeses data={celData} meses={mesesRecentes} labelKey="caixa" />
                    <div className="flex gap-3 flex-wrap mt-2">
                      {mesesRecentes.map((m, i) => (
                        <span key={m} className="flex items-center gap-1 text-xs text-slate-400">
                          <span className="w-3 h-3 rounded inline-block" style={{ background: CORES_MES[i] }} />{m}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-300 mb-3">Volume e Média por Ciclo</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {cicloDados.map((c) => (
                      <div key={c.ciclo} className="card p-4 text-center">
                        <p className="text-xs text-slate-400 mb-1">{c.ciclo}° CICLO</p>
                        <p className="text-2xl font-extrabold" style={{ color: mediaColor(c.media) }}>{fmt(c.media)}</p>
                        <p className="text-xs text-slate-500">{c.volume} avaliações</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ACOMPANHAMENTO */}
            {tab === "Acompanhamento" && (
              <div className="space-y-6">
                <h2 className="text-base font-bold text-slate-200">
                  Acompanhamento Monitorias | {processo} | {filtroMes !== "Todos" ? filtroMes : meses[meses.length - 1] || "–"}
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div>
                    <h3 className="text-sm font-bold text-slate-300 mb-3">Quadro de Acompanhamento</h3>
                    <table className="w-full text-sm border border-navy-600 rounded-xl overflow-hidden">
                      <thead>
                        <tr style={{ background: "#1B2A4A" }}>
                          <th className="py-2 px-3 text-left text-xs text-slate-300 font-bold">Status</th>
                          {[1,2,3,4].map((c) => <th key={c} className="py-2 px-3 text-center text-xs text-slate-300 font-bold">{c}° Ciclo</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-navy-600">
                          <td className="py-2 px-3 text-slate-300">Ativos</td>
                          {quadroCiclo.map((q) => <td key={q.ciclo} className="py-2 px-3 text-center text-slate-200 font-semibold">{q.ativos}</td>)}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-300 mb-3">Média por Ciclo</h3>
                    <table className="w-full text-sm border border-navy-600 rounded-xl overflow-hidden">
                      <thead>
                        <tr style={{ background: "#1B2A4A" }}>
                          <th className="py-2 px-3 text-left text-xs text-slate-300 font-bold">Ciclo</th>
                          <th className="py-2 px-3 text-right text-xs text-slate-300 font-bold">Média de Nota</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cicloDados.map((c) => (
                          <tr key={c.ciclo} className="border-t border-navy-600">
                            <td className="py-2 px-3 text-slate-300">{c.ciclo}°</td>
                            <td className="py-2 px-3 text-right font-bold" style={{ color: mediaColor(c.media) }}>{pct(c.media)}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-navy-500" style={{ background: "#1B2A4A" }}>
                          <td className="py-2 px-3 font-bold text-slate-200">Total Geral</td>
                          <td className="py-2 px-3 text-right font-bold" style={{ color: mediaColor(kpis.media) }}>{pct(kpis.media)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-300 mb-3">Consolidado – Caixas Avaliadas</h3>
                  <ChartVolNota data={caixasAval} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-300 mb-3">Analistas</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: "#1B2A4A" }}>
                          {["Analista","Caixa(s)","Volume","Média","NC","NCG","Status"].map((h) => (
                            <th key={h} className="py-2 px-3 text-left text-slate-300 font-bold whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {analistaDados.map((a, i) => {
                          const { label, cls } = statusBadge(a.media);
                          return (
                            <tr key={a.analista} className={`border-t border-navy-600 ${i % 2 === 0 ? "" : "bg-navy-700/20"}`}>
                              <td className="py-1.5 px-3 text-slate-200 font-medium whitespace-nowrap">{a.analista.split(" ").slice(0,2).join(" ")}</td>
                              <td className="py-1.5 px-3 text-slate-400 text-xs">{a.caixas.map(abrevCaixa).join(", ")}</td>
                              <td className="py-1.5 px-3 text-center text-slate-300">{a.volume}</td>
                              <td className="py-1.5 px-3 text-center font-bold" style={{ color: mediaColor(a.media) }}>{pct(a.media)}</td>
                              <td className="py-1.5 px-3 text-center text-amber-400">{a.ncs}</td>
                              <td className="py-1.5 px-3 text-center text-red-400">{a.ncgs}</td>
                              <td className="py-1.5 px-3"><span className={`${cls} text-xs font-semibold px-2 py-0.5 rounded-full`}>{label}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* INDICADORES */}
            {tab === "Indicadores" && (
              <div className="space-y-6">
                <h2 className="text-base font-bold text-slate-200">Indicadores de Qualidade | {processo} | {periodoLabel}</h2>
                <div className="grid grid-cols-3 gap-4">
                  <KpiPill label="Nota Máxima" val={pct(kpis.pctMeta)} vol={`${pct(kpis.pctMeta)} vol. (${kpis.nota100})`} color="#00D664" />
                  <KpiPill label="NC" val={pct(kpis.pctNC)} vol={`${pct(kpis.pctNC)} vol. (${kpis.ncs})`} color="#F59E0B" />
                  <KpiPill label="NCG" val={pct(kpis.pctNCG)} vol={`${pct(kpis.pctNCG)} vol. (${kpis.ncgs})`} color="#EF4444" />
                </div>
                {caixasAtivas.map((cx) => {
                  const cr = causaRaiz.filter((r) => r.caixa === cx);
                  if (!cr.length) return null;
                  return (
                    <div key={cx} className="card p-4">
                      <h3 className="text-sm font-bold text-slate-300 mb-3">Apontamentos | {abrevCaixa(cx)}</h3>
                      <div className="space-y-2">
                        {cr.map((r, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                            <span className="text-amber-400 font-bold mt-0.5">›</span>
                            <span><b>{pct(r.peso)}</b> – {r.causaRaiz} ({r.peso < 100 ? "NC" : "OK"}) · 1 sinalização.</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div>
                  <h3 className="text-sm font-bold text-slate-300 mb-3">Causa Raiz – Analistas</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: "#1B2A4A" }}>
                          {["Causa Raiz","Analista","Ciclo","Assunto","Peso","Média Analista","Mês"].map((h) => (
                            <th key={h} className="py-2 px-2 text-left text-slate-300 font-bold whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {causaRaiz.map((r, i) => (
                          <tr key={i} className={`border-t border-navy-600 ${i % 2 === 0 ? "" : "bg-navy-700/20"}`}>
                            <td className="py-1.5 px-2 text-slate-200 max-w-xs truncate">{r.causaRaiz}</td>
                            <td className="py-1.5 px-2 text-slate-300 whitespace-nowrap">{r.analista.split(" ").slice(0,3).join(" ")}</td>
                            <td className="py-1.5 px-2 text-center text-slate-400">{r.ciclo}°</td>
                            <td className="py-1.5 px-2 text-slate-400">{abrevCaixa(r.assunto)}</td>
                            <td className="py-1.5 px-2 text-center font-bold" style={{ color: mediaColor(r.peso) }}>{r.peso}</td>
                            <td className="py-1.5 px-2 text-center font-bold" style={{ color: mediaColor(r.mediaAnalista) }}>{pct(r.mediaAnalista)}</td>
                            <td className="py-1.5 px-2 text-slate-500">{r.mes}</td>
                          </tr>
                        ))}
                        {causaRaiz.length === 0 && (
                          <tr><td colSpan={7} className="py-6 text-center text-slate-500">Nenhum apontamento no período</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* OFENSORES */}
            {tab === "Ofensores" && (
              <div className="space-y-6">
                <h2 className="text-base font-bold text-slate-200">Médias de Qualidade | Últimos 3 meses – {processo}</h2>
                <div>
                  <h3 className="text-sm font-bold text-slate-300 mb-3">Assunto Ofensor</h3>
                  <ChartMeses data={ofensorData} meses={mesesRecentes} labelKey="label" />
                  <div className="flex gap-3 mt-2">
                    {mesesRecentes.map((m, i) => (
                      <span key={m} className="flex items-center gap-1 text-xs text-slate-400">
                        <span className="w-3 h-3 rounded inline-block" style={{ background: CORES_MES[i] }} />{m}
                      </span>
                    ))}
                  </div>
                </div>
                {caixasAtivas.map((cx) => {
                  const cr = causaRaiz.filter((r) => r.caixa === cx);
                  if (!cr.length) return null;
                  const uniqAn = [...new Set(cr.map((r) => r.analista))];
                  const anData = uniqAn.map((an) => {
                    const reg = cr.filter((r) => r.analista === an);
                    return { nome: an.split(" ").slice(0,2).join(" "), qty: reg.length, media: reg.reduce((s, r) => s + r.mediaAnalista, 0) / reg.length };
                  });
                  return (
                    <div key={cx}>
                      <h3 className="text-sm font-bold text-slate-300 mb-3">Ofensor {abrevCaixa(cx)}</h3>
                      <ResponsiveContainer width="100%" height={180}>
                        <ComposedChart data={anData} margin={{ top: 22, right: 10, left: -10, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2d3548" />
                          <XAxis dataKey="nome" tick={{ fill: "#94a3b8", fontSize: 9 }} angle={-20} textAnchor="end" />
                          <YAxis yAxisId="q" orientation="left" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                          <YAxis yAxisId="m" orientation="right" domain={[0,100]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                          <Tooltip contentStyle={{ background: "#1a2030", border: "1px solid #3a4256", borderRadius: 8 }} />
                          <Bar yAxisId="q" dataKey="qty" fill="#1B2A4A" radius={[3,3,0,0]} name="Qtd">
                            <LabelList dataKey="qty" position="top" style={{ fill: "#e2e8f0", fontSize: 10, fontWeight: 700 }} />
                          </Bar>
                          <Line yAxisId="m" type="monotone" dataKey="media" stroke="#00A4E0" strokeWidth={2}
                            strokeDasharray="4 3" dot={{ fill: "#00A4E0", r: 4 }} name="Média">
                            <LabelList dataKey="media" position="top" style={{ fill: "#00A4E0", fontSize: 10, fontWeight: 700 }}
                              formatter={(v: number) => pct(v)} />
                          </Line>
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ANALISTAS 100% */}
            {tab === "Analistas 100%" && (
              <div className="space-y-6">
                <h2 className="text-base font-bold text-slate-200">
                  Acompanhamento Monitorias | 100% | {filtroMes !== "Todos" ? filtroMes : "Período"}
                </h2>
                {caixasAtivas.map((cx) => {
                  const avCx = filtered.filter((a) => a.caixa === cx);
                  const anCx = byAnalista(avCx).filter((a) => a.media >= 100);
                  if (!anCx.length) return null;
                  return (
                    <div key={cx}>
                      <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Média Monitoria | Analistas – {abrevCaixa(cx)}</h3>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={anCx.map((a) => ({ nome: a.analista.split(" ").slice(0,2).join(" "), pct: a.media }))}
                          margin={{ top: 20, right: 5, left: -15, bottom: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2d3548" />
                          <XAxis dataKey="nome" tick={{ fill: "#94a3b8", fontSize: 9 }} angle={-20} textAnchor="end" interval={0} />
                          <YAxis domain={[0,100]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                          <Tooltip contentStyle={{ background: "#1a2030", border: "1px solid #3a4256", borderRadius: 8 }}
                            formatter={(v: any) => [pct(v), "Média"]} />
                          <Bar dataKey="pct" fill="#00A4E0" radius={[4,4,0,0]}>
                            <LabelList dataKey="pct" position="top" style={{ fill: "#00D664", fontSize: 11, fontWeight: 700 }}
                              formatter={(v: number) => pct(v)} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })}
                {an100.length === 0 && <div className="text-center py-10 text-slate-500">Nenhum analista com 100% no filtro selecionado</div>}
                {anAbaixo.length > 0 && (
                  <div className="card p-4">
                    <h3 className="text-sm font-bold text-amber-400 mb-3">⚠ Analistas Abaixo da Meta</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {anAbaixo.map((a) => (
                        <div key={a.analista} className="rounded-xl p-3 border border-amber-500/30 bg-amber-500/5">
                          <p className="text-xs font-bold text-slate-300 mb-1">{a.analista.split(" ").slice(0,2).join(" ")}</p>
                          <p className="text-xl font-extrabold" style={{ color: mediaColor(a.media) }}>{pct(a.media)}</p>
                          <p className="text-xs text-slate-500">{a.volume} avaliações · {a.caixas.map(abrevCaixa).join(", ")}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 pb-4">Dashboard de Qualidade · Monitorias Cielo · Dados em tempo real via Firebase</p>
      </div>
    </div>
  );
}
 
