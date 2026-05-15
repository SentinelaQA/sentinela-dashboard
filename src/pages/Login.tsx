import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      const code = err.code || "";
      if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found"))
        setError("E-mail ou senha inválidos.");
      else if (code.includes("too-many-requests"))
        setError("Muitas tentativas. Aguarde alguns minutos.");
      else
        setError("Erro ao fazer login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: "linear-gradient(135deg, #1a1f2e 0%, #2d3548 50%, #1e2636 100%)" }}>
      <div className="card w-full max-w-sm p-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center text-4xl" style={{ background: "linear-gradient(135deg,#00A4E0,#00D664)", boxShadow: "0 4px 20px rgba(0,164,224,0.3)" }}>
            ✓
          </div>
          <h1 className="text-2xl font-extrabold gradient-text">Dashboard de Qualidade</h1>
          <p className="text-sm text-slate-400 mt-1">Monitorias Cielo</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg text-sm font-medium" style={{ background: "rgba(220,53,69,0.15)", color: "#ff6b7a", border: "1.5px solid rgba(220,53,69,0.4)" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-2">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@empresa.com.br"
              required
              className="w-full px-4 py-3 rounded-xl text-sm text-slate-200 placeholder-slate-600 outline-none focus:ring-2 focus:ring-brand-blue"
              style={{ background: "#1a1f2e", border: "2px solid #3a4256" }}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-2">Senha</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                required
                className="w-full px-4 py-3 rounded-xl text-sm text-slate-200 placeholder-slate-600 outline-none focus:ring-2 focus:ring-brand-blue"
                style={{ background: "#1a1f2e", border: "2px solid #3a4256" }}
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-white font-bold text-base transition-all hover:-translate-y-0.5 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#00A4E0,#00C85A)", boxShadow: loading ? "none" : "0 4px 15px rgba(0,164,224,0.35)" }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-8 pt-5 border-t border-navy-600 text-center">
          <p className="text-xs text-slate-500">
            Desenvolvido por <span className="font-bold gradient-text">Yasmin de Melo Campos</span>
            <br />Analista de Qualidade
          </p>
        </div>
      </div>
    </div>
  );
}
