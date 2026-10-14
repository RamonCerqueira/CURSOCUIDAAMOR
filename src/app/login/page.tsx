'use client'

import { FormEvent, useState } from 'react'
import { AlertCircle, Award, BookOpen, Eye, EyeOff, GraduationCap, Heart, Info, Lock, ShieldCheck, User } from 'lucide-react'
import './login.css'

export default function LoginPage() {
  const [identificador, setIdentificador] = useState('')
  const [senha, setSenha] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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
    <main className="cl-root">
      <aside className="cl-hero" aria-hidden="true">
        <div className="cl-brand">
          <div className="cl-brand-icon"><GraduationCap size={24} /></div>
          <div><b>CURSO CUIDA</b><span>Cuida Amor</span></div>
        </div>

        <div className="cl-hero-copy">
          <h2>Aprender a <em>cuidar</em> com amor, técnica e respeito.</h2>
          <p>Formação para quem faz do cuidado uma profissão. Acompanhe seus cursos, turmas e certificados em um só lugar.</p>
          <div className="cl-points">
            <span className="cl-point"><BookOpen size={15} /> Cursos práticos</span>
            <span className="cl-point"><Award size={15} /> Certificados</span>
            <span className="cl-point"><Heart size={15} /> Cuidado de verdade</span>
          </div>
        </div>

        <p className="cl-hero-foot">© {new Date().getFullYear()} Cuida Amor · Todos os direitos reservados</p>
      </aside>

      <section className="cl-panel">
        <form onSubmit={submit} className="cl-card" noValidate={false}>
          <div className="cl-mobile-brand">
            <div className="cl-brand-icon"><GraduationCap size={20} /></div>
            <b>CURSO CUIDA</b>
          </div>

          <span className="cl-eyebrow"><Heart size={12} /> Cuida Amor</span>
          <h1>Bem-vindo de volta</h1>
          <p className="cl-sub">Entre com seu usuário ou e-mail cadastrado para acessar a plataforma de cursos.</p>

          <div className="cl-field">
            <label className="cl-label" htmlFor="login-identificador">Usuário ou e-mail</label>
            <div className="cl-input-wrap">
              <User className="cl-icon" size={18} />
              <input
                id="login-identificador"
                className="cl-input"
                type="text"
                autoComplete="username"
                placeholder="Seu usuário ou e-mail"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="cl-field">
            <label className="cl-label" htmlFor="login-senha">Senha</label>
            <div className="cl-input-wrap">
              <Lock className="cl-icon" size={18} />
              <input
                id="login-senha"
                className="cl-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Digite sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
              <button
                type="button"
                className="cl-eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {message && (
            <p role="alert" className="cl-error" key={message}>
              <AlertCircle size={18} />
              <span>{message}</span>
            </p>
          )}

          <button id="login-submit" type="submit" disabled={busy} className="cl-submit">
            {busy ? (<><span className="cl-spin" /> Entrando…</>) : (<><ShieldCheck size={18} /> Entrar</>)}
          </button>

          <p className="cl-help">
            <Info size={16} />
            <span>Use o <strong>usuário</strong> cadastrado no SoftCare ou o <strong>e-mail</strong> de aluno. Esqueceu a senha? Fale com a administração.</span>
          </p>
        </form>
        <p className="cl-copy">Cuida Amor · Plataforma de Cursos</p>
      </section>
    </main>
  )
}
