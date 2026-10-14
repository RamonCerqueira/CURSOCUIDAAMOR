'use client'

import { FormEvent, useState } from 'react'

export default function LoginPage() {
  const [identificador, setIdentificador] = useState('')
  const [senha, setSenha] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: identificador.trim(),
          email: identificador.trim(),
          senha: senha.trim()
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.mensagem || 'Não foi possível entrar.')
      }

      const params = new URLSearchParams(window.location.search)
      const returnTo = params.get('returnTo')

      if (returnTo) {
        window.location.href = returnTo
      } else if (json.redirectTo) {
        window.location.href = json.redirectTo
      } else if (json.role === 'ADMIN' || json.role === 'SUPERVISOR') {
        window.location.href = '/admin/dashboard'
      } else {
        window.location.href = '/aluno'
      }
    } catch (error: any) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0f19] text-slate-100 grid place-items-center p-6">
      <form onSubmit={submit} className="glass-panel w-full max-w-md p-8">
        <p className="text-xs uppercase tracking-widest text-indigo-300">SoftCare · Cursos</p>
        <h1 className="text-2xl font-bold mt-2">Acesso ao Sistema</h1>
        <p className="text-sm text-slate-400 mt-2 mb-6">
          Acesse com seu usuário ou e-mail cadastrado e sua senha.
        </p>

        <label className="block text-sm mb-4">
          Usuário ou E-mail
          <input
            className="w-full mt-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-indigo-400 transition"
            type="text"
            autoComplete="username"
            placeholder="Ex: otavio ou seu e-mail"
            value={identificador}
            onChange={(e) => setIdentificador(e.target.value)}
            required
          />
        </label>

        <label className="block text-sm mb-5">
          Senha
          <input
            className="w-full mt-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-indigo-400 transition"
            type="password"
            autoComplete="current-password"
            placeholder="Digite sua senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
        </label>

        {message && (
          <p role="alert" className="text-sm text-rose-300 mb-4 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl">
            {message}
          </p>
        )}

        <button
          disabled={busy}
          className="gradient-btn w-full rounded-xl px-4 py-3 font-semibold disabled:opacity-50 transition"
        >
          {busy ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="text-xs text-slate-500 mt-5">
          Utilize seu usuário cadastrado no SoftCare (como <strong className="text-slate-400 font-medium">otavio</strong>) ou e-mail de aluno.
        </p>
      </form>
    </main>
  )
}
