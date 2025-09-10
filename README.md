# SIH 2025 – FloatChat

Conversational ocean-intelligence platform that lets researchers, analysts, and citizens ask natural-language questions about the ocean and receive answers grounded in real observational data and predictive analytics.

Summary
- AI chat interface connected to ocean datasets (e.g., Argo float profiles) and geospatial analytics
- Modular tri-layer architecture: React client, Node/Express server, Python analytics core
- Visual exploration via time series, heatmaps, and map point overlays
- Pragmatic, data-first design enabling extensible tools and models

Repository layout
- [client/](client/)
  - React front-end, chat UI, session and context
  - Key screen: [client/src/pages/Chat.jsx](client/src/pages/Chat.jsx)
- [server/](server/)
  - Node.js/Express backend, API gateway, DB integration
  - Entrypoint: [server/index.js](server/index.js)
  - Conversation handler: [server/controllers/conversation/sendMessage.js](server/controllers/conversation/sendMessage.js)
  - Predictions runner: [server/controllers/predictions/run.js](server/controllers/predictions/run.js)
  - Database config: [server/config/db.js](server/config/db.js)
- [core/](core/)
  - Python analytics and ETL
  - ETL pipelines and sample Argo NetCDFs under [core/ETL/](core/ETL/)
  - Prediction orchestration: [core/predictions/prediction.py](core/predictions/prediction.py)
  - MCP tool adapters (analytics/plots):
    - [core/mcp/tools/timeseries_plot.py](core/mcp/tools/timeseries_plot.py)
    - [core/mcp/tools/heatmap_plot.py](core/mcp/tools/heatmap_plot.py)
    - [core/mcp/tools/heatmap_api.py](core/mcp/tools/heatmap_api.py)
    - [core/mcp/tools/map_points_plot.py](core/mcp/tools/map_points_plot.py)
    - [core/mcp/tools/map_points_api.py](core/mcp/tools/map_points_api.py)
- Environment examples
  - Client env: [client/.env](client/.env)
  - Server env: [server/.env](server/.env)
  - Core env: [core/.env](core/.env)

What problems it solves
- Makes complex ocean data discoverable through natural language and visualizations
- Streamlines ETL and analytics so insights are reproducible and explainable
- Bridges scripting-heavy workflows with a guided chat experience

Core capabilities
- Conversational querying of observational and derived datasets
- On-demand plots:
  - Time series at a location or region
  - Spatial heatmaps for variables of interest
  - Point-based map overlays from empirical samples
- Prediction runs and what-if analysis via the Python core
- Data provenance and reproducibility through explicit tool calls

High-level architecture
- Client (React)
  - Presents chat interface and results (text + charts/maps)
  - Manages session and minimal local state
- Server (Node/Express)
  - Single entry to data/tools; handles auth, rate limits, and orchestration
  - Normalizes requests from client to Python tools and services
- Core (Python)
  - Houses ETL jobs, analytics, and predictive routines
  - Provides well-typed tool adapters used by the server

End-to-end flow
1. User asks a question in the chat on the client.
2. The server receives the message in [server/controllers/conversation/sendMessage.js](server/controllers/conversation/sendMessage.js), resolves intent, and selects appropriate tools.
3. When analytics are required, the server calls into the core (e.g., [core/predictions/prediction.py](core/predictions/prediction.py) or MCP tools under [core/mcp/tools/](core/mcp/tools/)).
4. Core reads curated datasets from [core/ETL/](core/ETL/), performs computations, and returns results (numbers, geojson, figure images).
5. The server shapes the response and sends it to the client for rendering.

Data and ETL
- The repository contains sample Argo profiles under [core/ETL/argo_nc/](core/ETL/argo_nc/).
- ETL scripts clean and stage observational data for fast analytics.
- This design keeps raw ingest, transformations, and model inputs auditable.

Predictions and analytics
- The orchestrator in [core/predictions/prediction.py](core/predictions/prediction.py) demonstrates how server-triggered analytics are run and traced.
- Plotting and data APIs live under [core/mcp/tools/](core/mcp/tools/), enabling map/time-series visualizations alongside narrative answers.

Minimal run instructions
- Prerequisites:
  - Node.js 18+ and npm
  - Python 3.10+ and pip
  - Optional: MongoDB (if persistence is enabled in [server/config/db.js](server/config/db.js))
- Environment:
  - Copy and fill the variables in [client/.env](client/.env), [server/.env](server/.env), and [core/.env](core/.env) as appropriate for your machine.
- Install and run (indicative, not exhaustive):
  - Client: cd client && npm install && npm run dev
  - Server: cd server && npm install && npm run dev
  - Core: python -m venv .venv && source .venv/bin/activate && pip install -r [core/requirements.txt](core/requirements.txt)
- Data:
  - The project ships with sample NetCDFs under [core/ETL/argo_nc/](core/ETL/argo_nc/). You can replace or augment with your own datasets following the same folder structure.

Configuration tips
- Keep heavy credentials in [server/.env](server/.env) and [core/.env](core/.env).
- Use small, representative datasets during development; scale up in staging/production.
- When adding a new analytical tool, mirror the conventions used in files under [core/mcp/tools/](core/mcp/tools/).

Extending the system
- Add a new analytic/plot:
  - Implement a Python adapter in [core/mcp/tools/](core/mcp/tools/) (follow an existing file as a template).
  - Expose a corresponding server route/controller under [server/controllers/](server/controllers/).
  - Render results on the client by adding a lightweight component under [client/src/components/](client/src/components/).
- Add a new dataset:
  - Place raw or staged data under an appropriate path in [core/ETL/](core/ETL/).
  - Update your ETL script to ingest/transform and document inputs/outputs.

Tech stack
- Frontend: React, Vite ecosystem
- Backend: Node.js, Express, MongoDB
- Analytics: Python, NumPy/Pandas, geospatial/plotting libs

Conventions
- Code lives in clear, single-language subtrees (JS in server/client, Python in core).
- Environment variables are repo-local; keep secrets out of version control.
- Prefer small, composable tools that can be orchestrated by the server.

Roadmap (indicative)
- Expand toolset for additional ocean variables and model outputs
- Add caching for common analytics queries
- Harden schema and metadata for data lineage end-to-end
- Improve map layers and interactivity in the client

Acknowledgements
- Argo Program and participating data centers for open ocean observations
- Open-source communities across Python, Node.js, and React ecosystems

License
- To be finalized by project owners. Until then, treat as All Rights Reserved.
