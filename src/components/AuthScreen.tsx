import { useState, type FormEvent } from 'react'
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

type AuthMode = 'login' | 'signup'

export default function AuthScreen({ configured, onContinueDemo }: { configured: boolean; onContinueDemo: () => void }) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMessage('')
    try {
      const result = mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          })

      if (result.error) {
        setMessage(result.error.message)
        return
      }
      if (mode === 'signup' && !result.data.session) {
        setMessage('Cuenta creada. Revisa tu correo para confirmar el registro.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo conectar con Supabase.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-brand-panel">
        <a className="brand auth-brand" href="#inicio" aria-label="NeuroLab">
          <span className="brand-mark"><span /><span /><span /><i /></span>
          <span className="brand-copy">neuro<span>lab</span><small>STUDIO / 01</small></span>
        </a>
        <div className="auth-intro">
          <span className="eyebrow">LABORATORIO DE VISIÓN ARTIFICIAL</span>
          <h1>De la imagen<br />al aprendizaje.</h1>
          <p>Diseña y explora modelos convolucionales en un espacio de trabajo creado para experimentar.</p>
        </div>
        <div className="auth-art" aria-hidden="true"><div className="auth-art-image"><i /><i /><i /><i /></div><div className="auth-art-lines"><i /><i /><i /><i /><i /><i /></div><div className="auth-art-nodes"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><span>CNN / 128 × 128 × 3</span></div>
        <div className="auth-foot"><ShieldCheck size={15} /> Acceso protegido por Supabase Auth</div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand"><span className="brand-mark"><span /><span /><span /><i /></span><strong>neurolab</strong></div>
          <span className="eyebrow">{configured ? 'ESPACIO DE TRABAJO' : 'CONFIGURACIÓN INICIAL'}</span>
          <h2>{configured ? (mode === 'login' ? 'Qué bueno verte.' : 'Crea tu cuenta.') : 'Conecta tu espacio.'}</h2>
          <p className="auth-subtitle">{configured
            ? 'Ingresa a tu cuenta para acceder a tus proyectos y arquitecturas.'
            : 'Agrega las variables de Supabase en .env.local para habilitar las cuentas y guardar proyectos.'}</p>

          {configured ? <form className="auth-form" onSubmit={submit}>
            <label htmlFor="auth-email">Correo electrónico</label>
            <div className="auth-input"><Mail size={16} /><input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" required /></div>
            <label htmlFor="auth-password">Contraseña</label>
            <div className="auth-input"><LockKeyhole size={16} /><input id="auth-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} required /></div>
            {message && <div className="auth-message" role="status">{message}</div>}
            <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? 'Un momento...' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}<ArrowRight size={16} /></button>
            <p className="auth-switch">{mode === 'login' ? '¿Primera vez aquí?' : '¿Ya tienes una cuenta?'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}>{mode === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}</button></p>
          </form> : <div className="auth-config-note"><div className="auth-config-code"><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_ANON_KEY</code></div><p>Guarda la URL y la clave pública <code>anon</code> de tu proyecto en un archivo `.env.local`. Nunca uses la clave `service_role` en el frontend.</p><a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Abrir Supabase <ArrowRight size={14} /></a></div>}

          {!configured && <button className="button button-outline auth-demo" onClick={onContinueDemo}>Continuar en modo demo</button>}
          <div className="auth-privacy"><LockKeyhole size={13} /> Tus proyectos se aíslan por usuario mediante políticas RLS.</div>
        </div>
        <div className="auth-copyright">NEUROLAB ENTERPRISE <span>·</span> CNN STUDIO</div>
      </section>
    </main>
  )
}