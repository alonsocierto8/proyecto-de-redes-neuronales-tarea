import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  Activity,
  ArrowDown,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Database,
  FileImage,
  FolderKanban,
  Layers3,
  LayoutDashboard,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import AuthScreen from './components/AuthScreen'
import { supabase, supabaseConfigured } from './lib/supabase'

type View = 'overview' | 'architecture' | 'datasets' | 'training'
type Layer = { id: number; name: string; detail: string; kind: 'input' | 'conv' | 'pool' | 'dense' | 'output' }
type Project = { id: string; name: string; description: string; created_at: string }

const initialLayers: Layer[] = [
  { id: 1, name: 'Entrada', detail: '128 × 128 × 3', kind: 'input' },
  { id: 2, name: 'Conv2D', detail: '32 filtros · 3 × 3 · ReLU', kind: 'conv' },
  { id: 3, name: 'MaxPooling2D', detail: 'Ventana 2 × 2', kind: 'pool' },
  { id: 4, name: 'Conv2D', detail: '64 filtros · 3 × 3 · ReLU', kind: 'conv' },
  { id: 5, name: 'GlobalAveragePooling2D', detail: 'Reducción espacial', kind: 'pool' },
  { id: 6, name: 'Dense', detail: '3 unidades · Softmax', kind: 'output' },
]

const lossData = [
  { epoch: 1, loss: 1.08, validation: 1.1 },
  { epoch: 2, loss: 0.79, validation: 0.87 },
  { epoch: 3, loss: 0.58, validation: 0.69 },
  { epoch: 4, loss: 0.43, validation: 0.56 },
  { epoch: 5, loss: 0.34, validation: 0.48 },
  { epoch: 6, loss: 0.27, validation: 0.42 },
  { epoch: 7, loss: 0.22, validation: 0.39 },
  { epoch: 8, loss: 0.18, validation: 0.36 },
]

const navigation: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
  { id: 'architecture', label: 'Arquitectura CNN', icon: Layers3 },
  { id: 'datasets', label: 'Datasets', icon: Database },
  { id: 'training', label: 'Entrenamientos', icon: Activity },
]

function App() {
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
  const [view, setView] = useState<View>('overview')
  const [layers, setLayers] = useState(initialLayers)
  const [demoRunning, setDemoRunning] = useState(false)
  const [trainingMetrics, setTrainingMetrics] = useState<{ loss: number; accuracy: number; epochs: number; lossHistory: number[]; validationLossHistory: number[] } | null>(null)
  const [demoMode, setDemoMode] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!supabaseConfigured)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectError, setProjectError] = useState('')
  const [projectReload, setProjectReload] = useState(0)
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setUser(data.session?.user ?? null)
        setAuthReady(true)
      }
    }).catch(() => {
      if (active) setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthReady(true)
      if (session) setDemoMode(false)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !user) {
      setProjects([])
      setProjectsLoading(false)
      return
    }
    let active = true
    setProjectsLoading(true)
    setProjectError('')
    supabase.from('projects').select('id,name,description,created_at').order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return
        if (error) setProjectError(error.message)
        else setProjects((data ?? []) as Project[])
        setProjectsLoading(false)
      })
    return () => { active = false }
  }, [user, projectReload])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }

  const addLayer = (kind: 'conv' | 'pool' | 'dense') => {
    const presets = {
      conv: { name: 'Conv2D', detail: '32 filtros · 3 × 3 · ReLU', kind: 'conv' as const },
      pool: { name: 'MaxPooling2D', detail: 'Ventana 2 × 2', kind: 'pool' as const },
      dense: { name: 'Dense', detail: '64 unidades · ReLU', kind: 'dense' as const },
    }
    const next = [...layers]
    next.splice(next.length - 1, 0, { id: Date.now(), ...presets[kind] })
    setLayers(next)
  }

  const startDemo = async () => {
    setDemoRunning(true)
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/cnn/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_shape: [32, 32, 3],
          num_classes: 3,
          epochs: 4,
          batch_size: 16,
          learning_rate: 0.001,
          dataset_size: 256,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.detail ?? 'No se pudo entrenar la CNN.')
      }
      const payload = await response.json()
      setTrainingMetrics({
        loss: Number(payload.loss),
        accuracy: Number(payload.accuracy),
        epochs: Number(payload.epochs),
        lossHistory: payload.loss_history.map(Number),
        validationLossHistory: payload.validation_loss_history.map(Number),
      })
      notify(`Prueba CNN completada con datos sintéticos: pérdida ${Number(payload.loss).toFixed(3)} y precisión ${(Number(payload.accuracy) * 100).toFixed(1)}%.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo entrenar la CNN.')
    } finally {
      setDemoRunning(false)
    }
  }

  const createProject = async (name: string) => {
    if (!supabase || !user) {
      setProjects((current) => [{
        id: crypto.randomUUID(), name, description: '', created_at: new Date().toISOString(),
      }, ...current])
      setShowProjectForm(false)
      notify('Proyecto creado solo en esta sesión de demostración.')
      return
    }
    const { error } = await supabase.from('projects').insert({ owner_id: user.id, name })
    if (error) {
      notify(`No se pudo guardar el proyecto: ${error.message}`)
      return
    }
    setShowProjectForm(false)
    setProjectReload((current) => current + 1)
    notify('Proyecto guardado en Supabase.')
  }

  const activeTitle = navigation.find((item) => item.id === view)?.label ?? 'Resumen'
  const activeProject = projects[0]

  if (!authReady) return <div className="auth-loading">Preparando tu espacio seguro...</div>
  if (!user && !demoMode) return <AuthScreen configured={supabaseConfigured} onContinueDemo={() => setDemoMode(true)} />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#inicio" onClick={() => setView('overview')} aria-label="NeuroLab, inicio">
          <span className="brand-mark"><span /><span /><span /><i /></span>
          <span className="brand-copy">neuro<span>lab</span><small>STUDIO / 01</small></span>
        </a>

        <div className="workspace-switcher">
          <div className="workspace-avatar">N</div>
          <div className="workspace-copy"><strong>NeuroLab Studio</strong><small>Espacio personal</small></div>
          <ChevronDown size={15} />
        </div>

        <div className="nav-label">ESPACIO DE TRABAJO</div>
        <nav className="main-nav" aria-label="Navegación principal">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => setView(id)}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
              {id === 'training' && <span className="nav-count">2</span>}
            </button>
          ))}
        </nav>

        <div className="nav-label project-label">PROYECTOS <button aria-label="Crear proyecto" onClick={() => setShowProjectForm(true)}><Plus size={15} /></button></div>
        {projects.map((project) => <button key={project.id} className={`project-link ${activeProject?.id === project.id ? 'selected' : ''}`} onClick={() => setView('overview')}><span className="project-dot dot-green" />{project.name}<MoreHorizontal size={16} /></button>)}
        {!projectsLoading && projects.length === 0 && <div className="empty-projects">Aún no tienes proyectos</div>}
        {projectError && <div className="project-load-error">No se pudieron cargar los proyectos</div>}
        <button className="new-project" onClick={() => setShowProjectForm(true)}><Plus size={15} /> Nuevo proyecto</button>

        <div className="sidebar-spacer" />
        <div className="sidebar-help"><div className="help-icon"><CircleHelp size={17} /></div><div><strong>Centro de ayuda</strong><span>Guías y documentación</span></div><ArrowUpRight size={14} /></div>
        <button className="profile-button" title="Cerrar sesión" onClick={async () => { if (supabase && user) await supabase.auth.signOut(); setDemoMode(false) }}><div className="profile-avatar">{user?.email?.slice(0, 2).toUpperCase() ?? 'DE'}</div><div><strong>{user?.email ?? 'Modo demo'}</strong><span>{user ? 'Cuenta Supabase' : 'Demostración local'}</span></div><MoreHorizontal size={17} /></button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activeTitle}</strong></div>
          <div className="topbar-actions"><div className="system-status"><span /> {user ? 'Conectado a Supabase' : 'Modo de demostración'}</div><button className="icon-button" aria-label="Buscar" onClick={() => notify('Búsqueda disponible al conectar los proyectos.')}><Search size={18} /></button><button className="icon-button notification-button" aria-label="Notificaciones" onClick={() => notify('No tienes notificaciones nuevas.')}><Bell size={18} /><i /></button><div className="top-avatar">{user?.email?.slice(0, 2).toUpperCase() ?? 'DE'}</div></div>
        </header>

        <div className="page-content">
          {!user && <div className="demo-banner"><span /> PROTOTIPO · DATOS DE MUESTRA · SIN ENTRENAMIENTOS PERSISTIDOS</div>}
          {view === 'overview' && <Overview projects={projects} projectsLoading={projectsLoading} projectError={projectError} isDemo={!user} onOpenArchitecture={() => setView('architecture')} onNewProject={() => setShowProjectForm(true)} />}
          {view === 'architecture' && <Architecture layers={layers} onAddLayer={addLayer} onRemoveLayer={(id) => setLayers(layers.filter((layer) => layer.id !== id))} onValidation={notify} />}
          {view === 'datasets' && <Datasets onUpload={() => notify('La carga de archivos estará disponible al conectar Supabase Storage.')} />}
          {view === 'training' && <Training demoRunning={demoRunning} onTrain={startDemo} metrics={trainingMetrics} />}
        </div>
      </main>

      {showProjectForm && <ProjectModal onClose={() => setShowProjectForm(false)} onSave={createProject} />}
      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    </div>
  )
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function Overview({ projects, projectsLoading, projectError, isDemo, onOpenArchitecture, onNewProject }: { projects: Project[]; projectsLoading: boolean; projectError: string; isDemo: boolean; onOpenArchitecture: () => void; onNewProject: () => void }) {
  return <>
    <PageHeading eyebrow={isDemo ? 'VISTA DE DEMOSTRACIÓN · DATOS DE EJEMPLO' : 'ESPACIO DE TRABAJO'} title="Tu laboratorio, en marcha." description="Diseña, entrena y compara modelos de visión por computadora." action={<button className="button button-primary" onClick={onNewProject}><Plus size={16} /> Nuevo proyecto</button>} />
    <section className="welcome-strip"><div className="welcome-icon"><Sparkles size={19} /></div><div><strong>Un espacio para experimentar.</strong><span>Tu entorno está listo para construir tu próxima red convolucional.</span></div><button onClick={onOpenArchitecture}>Abrir diseñador <ArrowUpRight size={15} /></button><div className="strip-art" aria-hidden="true"><i /><i /><i /><i /><i /><i /><b /></div></section>
    <section className="metrics-grid" aria-label="Resumen del espacio">
      <MetricCard label="Proyectos" value={String(projects.length).padStart(2, '0')} detail={projectsLoading ? 'cargando...' : 'guardados en tu cuenta'} icon={<FolderKanban size={17} />} trend="" />
      <MetricCard label="Entrenamientos" value={isDemo ? '08' : '00'} detail={isDemo ? 'datos de muestra' : 'sin ejecuciones aún'} icon={<Activity size={17} />} trend="" />
      <MetricCard label="Modelos guardados" value={isDemo ? '05' : '00'} detail={isDemo ? 'datos de muestra' : 'sin versiones aún'} icon={<Layers3 size={17} />} trend="" />
      <MetricCard label="Datasets" value={isDemo ? '03' : '00'} detail={isDemo ? 'datos de muestra' : 'sin datasets aún'} icon={<Database size={17} />} trend="" />
    </section>
    <div className="overview-grid">
      <section className="panel projects-panel">
        <div className="panel-heading"><div><h2>Proyectos recientes</h2><p>Tu actividad de un vistazo</p></div><button className="text-button" onClick={onOpenArchitecture}>Ver todos <ArrowUpRight size={14} /></button></div>
        <div className="project-table-wrap"><table className="project-table"><thead><tr><th>PROYECTO</th><th>MODELO</th><th>CREADO</th><th>ESTADO</th><th /></tr></thead><tbody>
          {projectError && <tr><td colSpan={5}><div className="table-empty">Error al cargar proyectos: {projectError}</div></td></tr>}
          {projectsLoading && <tr><td colSpan={5}><div className="table-empty">Cargando tus proyectos...</div></td></tr>}
          {!projectsLoading && !projectError && projects.length === 0 && <tr><td colSpan={5}><div className="table-empty">Aún no tienes proyectos. Crea uno para empezar.</div></td></tr>}
          {projects.map((project) => <tr key={project.id}><td><div className="table-project"><span className="table-project-icon leaf"><FileImage size={16} /></span><span><strong>{project.name}</strong><small>{project.description || 'Proyecto CNN'}</small></span></div></td><td><span className="model-pill">CNN · borrador</span></td><td><span className="muted">{new Date(project.created_at).toLocaleDateString('es')}</span></td><td><span className="status status-draft"><i /> Creado</span></td><td><button className="row-action" aria-label={`Abrir ${project.name}`} onClick={onOpenArchitecture}><ArrowUpRight size={16} /></button></td></tr>)}
        </tbody></table></div>
        <button className="table-footer" onClick={onNewProject}><Plus size={15} /> Crear un proyecto</button>
      </section>
      <section className="panel activity-panel"><div className="panel-heading"><div><h2>Actividad reciente</h2><p>{isDemo ? 'Eventos de ejemplo' : 'Eventos en tu espacio'}</p></div><button className="icon-button small" aria-label="Más actividad"><MoreHorizontal size={18} /></button></div>
        {isDemo ? <div className="activity-list"><ActivityItem icon={<Check size={14} />} color="mint" title="Entrenamiento completado" detail="Clasificación de hojas · v1.2" time="hace 24 min" /><ActivityItem icon={<Database size={14} />} color="blue" title="Dataset actualizado" detail="hojas-validacion · 2,480 imágenes" time="hace 2 h" /><ActivityItem icon={<Layers3 size={14} />} color="orange" title="Nueva versión de modelo" detail="Control de calidad · v0.8" time="ayer, 16:42" /><ActivityItem icon={<ShieldCheck size={14} />} color="purple" title="Revisión aprobada" detail="Texturas industriales · CNN v2.1" time="28 oct, 11:08" /></div> : <div className="activity-empty">La actividad aparecerá aquí a medida que uses el espacio.</div>}
      </section>
    </div>
    <section className="panel quickstart"><div className="quickstart-copy"><span className="eyebrow">SIGUIENTE PASO</span><h2>Construye tu primera arquitectura</h2><p>Combina capas convolucionales y de agrupamiento para extraer patrones visuales de tus imágenes.</p><button className="button button-dark" onClick={onOpenArchitecture}>Diseñar una CNN <ArrowUpRight size={15} /></button></div><div className="mini-network" aria-label="Visualización de capas CNN"><div className="image-sample"><span /><span /><span /><span /></div><div className="network-lines"><i /><i /><i /><i /><i /><i /></div><div className="network-layer conv-layer"><b /><b /><b /><b /></div><div className="network-layer dense-layer"><b /><b /><b /></div><div className="network-layer output-layer"><b /><b /><b /></div></div></section>
  </>
}

function MetricCard({ label, value, detail, icon, trend }: { label: string; value: string; detail: string; icon: React.ReactNode; trend: string }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><div className="metric-value-row"><strong>{value}</strong>{trend && <span className="metric-trend"><ArrowUpRight size={13} />{trend}</span>}</div><div className="metric-detail">{detail}</div><div className="metric-sparkline"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div></article>
}

function ActivityItem({ icon, color, title, detail, time }: { icon: React.ReactNode; color: string; title: string; detail: string; time: string }) {
  return <div className="activity-item"><span className={`activity-icon ${color}`}>{icon}</span><div className="activity-copy"><strong>{title}</strong><span>{detail}</span></div><time>{time}</time></div>
}

function Architecture({ layers, onAddLayer, onRemoveLayer, onValidation }: { layers: Layer[]; onAddLayer: (kind: 'conv' | 'pool' | 'dense') => void; onRemoveLayer: (id: number) => void; onValidation: (message: string) => void }) {
  const [selectedLayer, setSelectedLayer] = useState(2)
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{ output_shape: number[]; parameter_count: number } | null>(null)
  const addMenu = [{ kind: 'conv' as const, label: 'Conv2D' }, { kind: 'pool' as const, label: 'MaxPooling2D' }, { kind: 'dense' as const, label: 'Dense' }]
  const validate = async () => {
    setValidating(true)
    setValidationResult(null)
    const config = {
      family: 'CNN',
      input_shape: [128, 128, 3],
      num_classes: 3,
      layers: layers.filter((layer) => layer.kind !== 'input').map((layer) => ({
        type: layer.name,
        filters: Number(/(\d+) filtros/.exec(layer.detail)?.[1] ?? 32),
        units: Number(/(\d+) unidades/.exec(layer.detail)?.[1] ?? 3),
        activation: /softmax/i.test(layer.detail) ? 'softmax' : 'relu',
        padding: 'same',
      })),
    }
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${baseUrl}/api/v1/cnn/architectures/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'La configuración no es válida.')
      setValidationResult(result)
      onValidation(`CNN válida: ${result.parameter_count.toLocaleString('es')} parámetros.`)
    } catch (error) {
      onValidation(error instanceof Error && error.message.includes('Failed to fetch')
        ? 'No se pudo conectar con la API. Iníciala siguiendo el README.'
        : error instanceof Error ? error.message : 'No se pudo validar la arquitectura.')
    } finally {
      setValidating(false)
    }
  }
  return <>
    <PageHeading eyebrow="DISEÑADOR DE MODELOS / CNN" title="Arquitectura de red" description="Define las capas y la forma de entrada para tu modelo de visión." action={<div className="heading-actions"><button className="button button-outline" onClick={() => window.print()}><ArrowDown size={15} /> Exportar</button><button className="button button-primary" onClick={validate} disabled={validating}><Check size={15} /> {validating ? 'Validando...' : 'Validar arquitectura'}</button></div>} />
    <div className="editor-toolbar"><div className="editor-project"><span className="project-dot dot-green" /><strong>Clasificación de hojas</strong><span className="toolbar-divider" /><span className="model-pill">Borrador</span></div><div className="editor-toolbar-right"><span className="saved-indicator"><Check size={13} /> Guardado localmente</span><button className="icon-button small" aria-label="Configuración"><Settings2 size={17} /></button></div></div>
    <div className="designer-layout">
      <section className="panel canvas-panel"><div className="canvas-heading"><div><span className="eyebrow">GRAFO DEL MODELO</span><h2>Red convolucional</h2></div><button className="icon-button small" aria-label="Más opciones"><MoreHorizontal size={18} /></button></div>
        <div className="canvas-meta"><span><i className="legend-dot input-dot" /> Entrada</span><span><i className="legend-dot conv-dot" /> Extracción de características</span><span><i className="legend-dot output-dot" /> Clasificación</span></div>
        <div className="layer-flow">{layers.map((layer, index) => <div className="flow-item" key={layer.id}><button className={`layer-node ${layer.kind} ${selectedLayer === layer.id ? 'chosen' : ''}`} onClick={() => setSelectedLayer(layer.id)}><span className="node-top"><span className="node-type">{layer.kind === 'input' ? 'INPUT' : layer.kind === 'output' ? 'OUTPUT' : layer.kind.toUpperCase()}</span>{layer.kind !== 'input' && layer.kind !== 'output' && <span className="node-menu" onClick={(event) => { event.stopPropagation(); onRemoveLayer(layer.id) }} role="button" aria-label={`Eliminar ${layer.name}`}><X size={13} /></span>}</span><strong>{layer.name}</strong><small>{layer.detail}</small><span className="node-visual"><i /><i /><i /><i /><i /></span></button>{index < layers.length - 1 && <div className="flow-connector"><span /><span /><span /><ArrowUpRight size={13} /></div>}</div>)}</div>
        <div className="add-layer-row"><span />{addMenu.map(({ kind, label }) => <button key={kind} onClick={() => onAddLayer(kind)}><Plus size={14} />{label}</button>)}<span /></div>
        <div className="canvas-footer"><span><Layers3 size={14} /> {layers.length} capas</span><span><Activity size={14} /> {validationResult ? `${validationResult.parameter_count.toLocaleString('es')} parámetros` : 'Sin validar'}</span><span className="canvas-valid"><Check size={14} /> CNN</span></div>
      </section>
      <aside className="designer-side">
        <section className="panel properties-panel"><div className="panel-heading compact"><div><span className="eyebrow">CONFIGURACIÓN</span><h2>Entrada del modelo</h2></div><Settings2 size={17} /></div><label className="field-label" htmlFor="input-shape">Forma de imagen</label><div className="shape-inputs"><input id="input-shape" type="number" defaultValue={128} aria-label="Ancho de imagen" /><span>×</span><input type="number" defaultValue={128} aria-label="Alto de imagen" /><span>×</span><input type="number" defaultValue={3} aria-label="Canales de imagen" /></div><div className="field-hint">Alto × ancho × canales de color</div><label className="field-label" htmlFor="activation">Función de activación</label><div className="select-wrap"><select id="activation" defaultValue="relu"><option value="relu">ReLU</option><option value="elu">ELU</option><option value="gelu">GELU</option></select><ChevronDown size={15} /></div><div className="field-label-row"><label className="field-label" htmlFor="dropout">Dropout</label><span>0.25</span></div><input id="dropout" className="range-input" type="range" min="0" max="0.8" step="0.05" defaultValue="0.25" /><div className="range-labels"><span>0.0</span><span>0.8</span></div></section>
        <section className="panel output-panel"><div className="panel-heading compact"><div><span className="eyebrow">CAPA DE SALIDA</span><h2>Clases objetivo</h2></div><button className="icon-button small" aria-label="Editar clases"><Settings2 size={16} /></button></div><div className="class-row"><span className="class-swatch swatch-one" />Sana <span>01</span></div><div className="class-row"><span className="class-swatch swatch-two" />Roya <span>02</span></div><div className="class-row"><span className="class-swatch swatch-three" />Mildiu <span>03</span></div><button className="add-class"><Plus size={14} /> Agregar clase</button></section>
        <div className={`validation-note ${validationResult ? '' : 'pending'}`}><ShieldCheck size={17} /><span><strong>{validationResult ? 'Arquitectura válida' : 'Validación pendiente'}</strong><small>{validationResult ? `Salida: ${validationResult.output_shape.join(' × ')}. Formas compatibles.` : 'Valida esta configuración con la API antes de entrenar.'}</small></span></div>
      </aside>
    </div>
  </>
}

function Datasets({ onUpload }: { onUpload: () => void }) {
  return <><PageHeading eyebrow="RECURSOS / DATASETS" title="Tus datasets" description="Organiza las imágenes y etiquetas para entrenar modelos CNN." action={<button className="button button-primary" onClick={onUpload}><Plus size={16} /> Añadir dataset</button>} /><section className="panel dataset-panel"><div className="panel-heading"><div><h2>Biblioteca de imágenes</h2><p>Datasets registrados en tu espacio</p></div><button className="icon-button" aria-label="Buscar datasets"><Search size={17} /></button></div><div className="dataset-list"><DatasetRow name="hojas-validacion" description="Imágenes de hojas · 3 clases" images="2,480" size="842 MB" color="green" /><DatasetRow name="hojas-entrenamiento" description="Imágenes de hojas · 3 clases" images="8,920" size="2.4 GB" color="orange" /><DatasetRow name="defectos-superficie" description="Inspección de piezas · 5 clases" images="5,160" size="1.1 GB" color="blue" /></div><div className="storage-footer"><div><Database size={15} /> Almacenamiento utilizado</div><div className="storage-bar"><span /></div><strong>4.3 GB <small>de 10 GB</small></strong></div></section><div className="info-callout"><BookOpen size={17} /><span><strong>Formato recomendado</strong> Organiza las imágenes en carpetas, una por clase. Se aceptan JPEG, PNG y WebP.</span></div></>
}

function DatasetRow({ name, description, images, size, color }: { name: string; description: string; images: string; size: string; color: string }) {
  return <div className="dataset-row"><span className={`dataset-icon ${color}`}><FileImage size={18} /></span><div className="dataset-name"><strong>{name}</strong><span>{description}</span></div><div className="dataset-stat"><strong>{images}</strong><span>imágenes</span></div><div className="dataset-stat"><strong>{size}</strong><span>tamaño</span></div><span className="status status-success"><i /> Validado</span><button className="row-action" aria-label={`Opciones de ${name}`}><MoreHorizontal size={17} /></button></div>
}

function Training({ demoRunning, onTrain, metrics }: { demoRunning: boolean; onTrain: () => void | Promise<void>; metrics: { loss: number; accuracy: number; epochs: number; lossHistory: number[]; validationLossHistory: number[] } | null }) {
  const accuracy = metrics ? (metrics.accuracy * 100).toFixed(1) : '94.8'
  const loss = metrics ? metrics.loss.toFixed(3) : '0.36'
  const epochs = metrics ? metrics.epochs : 8
  const chartData = metrics
    ? metrics.lossHistory.map((lossValue, index) => ({ epoch: index + 1, loss: lossValue, validation: metrics.validationLossHistory[index] }))
    : lossData

  return <><PageHeading eyebrow="EXPERIMENTOS / SEGUIMIENTO" title="Entrenamientos" description="Consulta las ejecuciones y métricas de tus modelos convolucionales." action={<button className="button button-primary" onClick={onTrain} disabled={demoRunning}><Play size={15} fill="currentColor" /> {demoRunning ? 'Entrenando...' : 'Probar entrenamiento CNN'}</button>} /><section className="training-highlight"><div className="training-highlight-top"><div><span className="status status-running"><i /> {demoRunning ? 'Entrenando con datos sintéticos' : 'Resultados de prueba'}</span><h2>Prueba CNN <span>· datos sintéticos</span></h2></div><button className="icon-button small" aria-label="Opciones"><MoreHorizontal size={18} /></button></div><div className="training-stats"><div><span>Épocas</span><strong>{epochs} <small>/ 20</small></strong></div><div><span>Accuracy</span><strong>{accuracy}<small>%</small></strong></div><div><span>Val. loss</span><strong>{loss}</strong></div><div><span>Duración</span><strong>04:32</strong></div></div><div className="progress-track"><span /></div><div className="progress-caption"><span>Progreso de entrenamiento</span><strong>40%</strong></div></section><section className="panel chart-panel"><div className="panel-heading"><div><h2>Pérdida por época</h2><p>Entrenamiento y validación</p></div><div className="chart-legend"><span><i className="legend-training" /> Entrenamiento</span><span><i className="legend-validation" /> Validación</span></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}><defs><linearGradient id="loss-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#82b96a" stopOpacity={0.25} /><stop offset="100%" stopColor="#82b96a" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#e9ece5" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="epoch" tickLine={false} axisLine={false} tick={{ fill: '#8a9085', fontSize: 11 }} label={{ value: 'Época', position: 'insideBottom', offset: -2, fill: '#8a9085', fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#8a9085', fontSize: 11 }} domain={[0, 1.2]} /><Tooltip contentStyle={{ border: '1px solid #e8ebe4', borderRadius: 8, fontSize: 12 }} /><Area type="monotone" dataKey="loss" stroke="#5d9950" strokeWidth={2.2} fill="url(#loss-fill)" name="Entrenamiento" /><Area type="monotone" dataKey="validation" stroke="#dfa456" strokeWidth={2} strokeDasharray="5 4" fill="transparent" name="Validación" /></AreaChart></ResponsiveContainer></div></section><section className="panel history-panel"><div className="panel-heading"><div><h2>Historial de ejecuciones</h2><p>Comparte y revisa resultados anteriores</p></div><button className="text-button">Ver historial <ArrowUpRight size={14} /></button></div><div className="history-row"><span className="history-version">v1.2</span><strong>Clasificación de hojas</strong><span className="status status-success"><i /> Completado</span><span className="muted"><Clock3 size={14} /> 30 oct, 10:42</span><span className="history-accuracy">94.8% acc.</span><button className="row-action" aria-label="Ver ejecución"><ArrowUpRight size={16} /></button></div><div className="history-row"><span className="history-version">v1.1</span><strong>Clasificación de hojas</strong><span className="status status-success"><i /> Completado</span><span className="muted"><Clock3 size={14} /> 29 oct, 15:18</span><span className="history-accuracy">91.2% acc.</span><button className="row-action" aria-label="Ver ejecución"><ArrowUpRight size={16} /></button></div></section></>
}

function ProjectModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string) => void | Promise<void> }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave(name.trim())
    } finally {
      setSaving(false)
    }
  }
  return <div className="modal-backdrop" onClick={onClose}><section className="project-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(event) => event.stopPropagation()}><div className="modal-top"><span className="modal-icon"><FolderKanban size={19} /></span><button className="icon-button small" aria-label="Cerrar" onClick={onClose}><X size={18} /></button></div><h2 id="modal-title">Nuevo proyecto CNN</h2><p>Crea un espacio para organizar la arquitectura, datasets y experimentos de tu modelo.</p><label htmlFor="project-name">Nombre del proyecto</label><input id="project-name" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Clasificador de plantas" autoFocus /><div className="modal-family"><span className="project-dot dot-green" /><span>Familia de red</span><strong>CNN · Convolucional</strong><Check size={15} /></div><div className="modal-actions"><button className="button button-outline" onClick={onClose} disabled={saving}>Cancelar</button><button className="button button-primary" onClick={save} disabled={!name.trim() || saving}><Plus size={15} /> {saving ? 'Guardando...' : 'Crear proyecto'}</button></div></section></div>
}

export default App