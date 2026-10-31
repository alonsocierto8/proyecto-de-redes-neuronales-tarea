# NeuroLab CNN

Plataforma web en desarrollo para diseñar y gestionar modelos de clasificación de imágenes con redes neuronales convolucionales (CNN). El alcance de este proyecto se limita a CNN; no incluye otras familias de redes.

## Estado actual

- Frontend React, TypeScript y Vite con panel, editor CNN, datasets y seguimiento de entrenamientos de muestra.
- Supabase Auth con registro/inicio de sesión y creación/consulta de proyectos protegidas por RLS.
- Editor de arquitectura CNN con capas Conv2D, MaxPooling2D, GlobalAveragePooling2D, Flatten y Dense.
- API FastAPI con validación de arquitecturas y entrenamiento CNN con TensorFlow/Keras.
- Migración SQL para Supabase/PostgreSQL, con políticas RLS para separar proyectos por usuario.
- Configuración inicial de despliegue en Vercel (web) y Render (API).

La primera prueba de entrenamiento ejecuta una CNN real con imágenes sintéticas generadas por la API; todavía no consume datasets cargados por el usuario ni persiste entrenamientos. La app ya usa Supabase Auth y guarda proyectos en la tabla `projects`; datasets, arquitecturas, trabajos y modelos aún no se conectan a la base de datos. No despliegues datos reales de imágenes hasta completar Storage y workers aislados.

## Requisitos

- Node.js 20 o posterior y npm.
- Python 3.12 para Render; Python 3.10 o posterior para desarrollo local.
- Proyecto de Supabase para aplicar la migración cuando se integre persistencia.

## Desarrollo local

Desde la raíz del repositorio, instala las dependencias del frontend:

```bash
npm install
```

En una terminal, instala e inicia la API:

```bash
python3 -m venv services/api/.venv
services/api/.venv/bin/pip install -r services/api/requirements.txt
cd services/api
.venv/bin/uvicorn main:app --reload --port 8000
```

En otra terminal, desde la raíz del repositorio, inicia la web:

```bash
npm run dev
```

La web estará en `http://localhost:5173`, la API en `http://localhost:8000` y OpenAPI en `http://localhost:8000/docs`. Para habilitar Auth y proyectos persistidos, crea el proyecto Supabase, aplica la migración SQL y copia `.env.example` a `.env.local`; configura `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_API_URL`, luego reinicia Vite. Si habilitas confirmación de correo, permite `http://localhost:5173` en las URL de redirección de Supabase Auth.

## Pruebas

```bash
npm run build
cd services/api
.venv/bin/python -m unittest
```

## Despliegue

1. **Supabase:** crea un proyecto PostgreSQL y aplica `supabase/migrations/20261030000000_initial_cnn_schema.sql` desde el SQL Editor. Configura la URL y la clave pública `anon` en Vercel. La tabla `projects` ya se usa; las demás tablas son el esquema de las siguientes etapas. Añade el dominio de Vercel a las URL permitidas de Supabase Auth.
2. **Render:** crea un Web Service desde el repositorio. `render.yaml` configura la raíz `services/api`, la instalación de requisitos y el comando Uvicorn. Define `WEB_ORIGIN` como la URL HTTPS de Vercel. El plan de Render debe permitir Python 3.12.
3. **Vercel:** importa el mismo repositorio como proyecto Vite. `vercel.json` establece build y salida. Configura `VITE_API_URL` con la URL HTTPS de Render antes de desplegar.

No pongas claves `service_role`, contraseñas de base de datos ni secretos del servidor en variables `VITE_*`; esas variables se incorporan al bundle del navegador. La clave pública `anon` no sustituye autenticación ni políticas RLS.

## API disponible

- `GET /health`: salud de la API.
- `POST /api/v1/cnn/architectures/validate`: valida `family`, forma de entrada, capas compatibles y salida Softmax.
- `POST /api/v1/cnn/train`: ejecuta una CNN TensorFlow con datos sintéticos y devuelve métricas de validación y el resumen del modelo. Parámetros: `input_shape`, `num_classes`, `epochs`, `batch_size`, `learning_rate` y `dataset_size`.

Ejemplo de solicitud:

```json
{
  "family": "CNN",
  "input_shape": [128, 128, 3],
  "num_classes": 3,
  "layers": [
    { "type": "Conv2D", "filters": 32, "padding": "same" },
    { "type": "MaxPooling2D" },
    { "type": "GlobalAveragePooling2D" },
    { "type": "Dense", "units": 3, "activation": "softmax" }
  ]
}
```

## Próximos incrementos

1. Conectar datasets y arquitecturas a sus tablas, implementar edición/eliminación de proyectos y carga segura a Supabase Storage.
2. Conectar Supabase Storage y sustituir los datos sintéticos por datasets etiquetados del usuario; mover el entrenamiento a un worker asíncrono de Render.
3. Persistir métricas/modelos y transmitir progreso; agregar pruebas de integración y autorización.