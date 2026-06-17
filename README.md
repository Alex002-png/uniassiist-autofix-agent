# UniAssiist AutoFix Agent

Sistema autónomo de monitoreo, detección de errores y auto-corrección para una SaaS educativa con IA. Funciona 24/7 sin intervención manual.

---

## ¿Qué hace?

Cuando algo se rompe en producción a las 3am, este sistema:

1. **Detecta** el error en los logs de Vercel
2. **Triagea** si es un error real o ruido (usando DeepSeek — bajo costo)
3. **Diagnostica** con Claude qué falló y genera el fix
4. **Commitea** el fix en GitHub automáticamente
5. **Redeploya** en Vercel sin intervención humana
6. **Verifica** que el nuevo deploy funcione
7. **Hace rollback** automático si el fix empeora las cosas

Todo esto sin que nadie toque nada.

---

## Stack

- **Node.js** — runtime principal
- **Anthropic SDK (Claude)** — diagnóstico profundo y generación del fix
- **DeepSeek API** — triage de bajo costo (primer filtro)
- **Vercel API** — monitoreo de logs y redeploy programático
- **GitHub API** — lectura y escritura de código en el repositorio
- **Telegram Bot API** — alertas, reportes y comandos remotos
- **node-cron** — tareas programadas (cada 5-10-15 minutos)
- **PM2** — gestión de procesos 24/7

---

## Arquitectura — 10 Agentes Especializados

```
┌─────────────────────────────────────────────────────────┐
│                    PIPELINE PRINCIPAL                   │
│                                                         │
│  Sentinel → Triage (DeepSeek) → Analyzer (Claude)      │
│      → Deployer → Verifier → AutoRollback               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  AGENTES DE SOPORTE                     │
│                                                         │
│  Security · Reporter · Commander · SSL Monitor          │
└─────────────────────────────────────────────────────────┘
```

| Agente | Responsabilidad | Frecuencia |
|--------|----------------|------------|
| **Sentinel** | Monitorea logs de Vercel, detecta errores runtime y deploy fallidos | Cada 10 min |
| **Triage** | Primer filtro con DeepSeek — clasifica si es ruido o error real | On demand |
| **Analyzer** | Usa Claude para leer el código en GitHub, diagnosticar y generar el fix | On demand |
| **Deployer** | Commitea el fix vía GitHub API y lanza redeploy en Vercel | On demand |
| **Verifier** | Verifica health del endpoint post-deploy | On demand |
| **AutoRollback** | Si el deploy falla, revierte al deployment anterior en 2 min | On demand |
| **Security** | Detecta brute force, rate limit attacks, secret leaks, SQL/prompt injection | Cada 10 min |
| **Reporter** | Reporte diario a las 9am Lima vía Telegram | Diario 9am |
| **Commander** | Interface de comandos Telegram (/status, /redeploy, /reporte) | On demand |
| **SSL Monitor** | Monitorea vencimiento de certificados SSL | Periódico |

---

## Pipeline LLM — Optimización de Costos

El sistema usa **dos modelos en pipeline** para balancear costo y calidad:

```
Error detectado
      ↓
DeepSeek (triage) ← barato y rápido
      ↓
  ¿Es real?
   NO → ignorar (80% de los casos)
   SÍ → Claude (análisis profundo + fix)
      ↓
  Fix generado → commit → deploy
```

Esto reduce el costo de API en ~80% comparado con usar Claude para todo.

---

## n8n Automation Suite

Sistema de 6 workflows que operan la SaaS de forma autónoma:

### Analytics Semanal
Cada lunes a las 9am Lima — consulta Supabase y health de PsyAssist en paralelo, envía reporte consolidado a Telegram.

![Analytics Semanal](./screenshots/analytics-semanal.png)

### UniAssiist Monitor
Cada 5 minutos — chequea PsyAssist Health, MedAssist Health y Vercel Deployments en paralelo. Si detecta issues envía alerta a Telegram, si todo OK registra silenciosamente.

![UniAssiist Monitor](./screenshots/monitor.png)

### Apply Fix (Redeploy Remoto)
Trigger por botones inline de Telegram — parsea el callback, decide la acción (PsyAssist / MedAssist / Dismiss), obtiene el último deploy de Vercel y ejecuta redeploy. Todo desde el celular sin abrir ningún dashboard.

![Apply Fix](./screenshots/apply-fix.png)

### Onboarding Días 1-3-7
Webhook POST al registrar usuario — envía emails transaccionales en los días 1, 3 y 7 automáticamente con nodos Wait entre cada envío.

![Onboarding](./screenshots/onboarding.png)

---

## Panel de Administración

Panel completo con métricas en tiempo real:

- Total de usuarios y usuarios activos
- Distribución por carrera (Psicología / Medicina)
- Usuarios con plan de pago
- Token usage por usuario con barra de progreso
- Filtros por plan, carrera, estado y fecha

![Panel Admin](./screenshots/admin-panel.png)

---

## Comandos Telegram

El sistema es controlable desde el celular en tiempo real:

![Comandos Telegram](./screenshots/telegram-commands.png)

```
/status   — Ver estado de todos los agentes
/redeploy — Forzar redeploy manual
/reporte  — Reporte inmediato
/help     — Ver comandos disponibles
```

---

## Producto en Uso

**UniAssiist** es la SaaS educativa que este sistema monitorea y protege:

- **PsyAssist IA** — Asistente académico para estudiantes de Psicología
- **MedAssist IA** — Asistente académico para estudiantes de Medicina
- 9 modos de estudio: chat libre, resumen, quiz, flashcards, caso clínico, modo tesis, estudio express, evaluar respuesta, citas APA/Vancouver
- Usuarios reales activos en producción

🔗 [uniassiist.com](https://uniassiist.com) · [psyassist.uniassiist.com](https://psyassist.uniassiist.com) · [medassist.uniassiist.com](https://medassist.uniassiist.com)

---

## Autor

**Alex Guerra Regin**
Lima, Perú · [guerraalex200@gmail.com](mailto:guerraalex200@gmail.com) · [github.com/Alex002-png](https://github.com/Alex002-png)
