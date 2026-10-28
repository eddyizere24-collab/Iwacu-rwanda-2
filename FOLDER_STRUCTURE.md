# IWACU RWANDA — Final Folder Structure (Phases 1–4)

```
iwacu-rwanda/
├── .env.example
├── DEPLOYMENT.md
├── FOLDER_STRUCTURE.md
├── README.md
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
│
├── sql/
│   └── schema.sql                          # PostGIS + RLS + confidence RPC + ingest RPC
│
├── scripts/
│   └── ingest-boundaries.ts                # GeoJSON → PostGIS (ST_MakeValid, SRID 4326)
│
├── public/
│   ├── manifest.json                       # PWA
│   ├── sw.js                               # Service Worker (read-only offline)
│   ├── icons/                              # (add icon-192.png, icon-512.png before prod)
│   └── offline/
│       └── gasabo-boundaries.geojson       # Cached for Turf.js offline confidence
│
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx                      # Inter, dark mode, SW register
    │   ├── page.tsx                        # Hero + locate CTA + results
    │   ├── admin/
    │   │   ├── layout.tsx
    │   │   ├── login/page.tsx              # Magic Link / OTP
    │   │   └── dashboard/page.tsx          # Scoped leaders table
    │   └── api/
    │       ├── locate/route.ts             # PostGIS confidence algorithm
    │       ├── leaders/route.ts            # GET (masked) + PATCH (optimistic lock)
    │       ├── ai-router/route.ts          # Groq Function Calling (zero PII)
    │       └── admin/
    │           └── leaders/route.ts        # Stub (dashboard uses /api/leaders)
    │
    ├── components/
    │   ├── LocationButton.tsx
    │   ├── LeaderCard.tsx                  # Masked phone + explicit tel: gesture
    │   ├── ErrorDisplay.tsx                # All 15 error states
    │   └── admin/
    │       └── LeaderEditForm.tsx          # 409 conflict diff UI
    │
    ├── hooks/
    │   └── useLocation.ts                  # GPS → online/offline paths
    │
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts                   # Browser client
    │   │   └── server.ts                   # Server + service-role clients
    │   ├── security/
    │   │   └── mask.ts                     # Phone masking
    │   ├── turf-logic.ts                   # Offline confidence (Turf.js)
    │   └── utils/
    │       └── errors.ts                   # Formal Kinyarwanda error messages
    │
    └── types/
        ├── api.ts
        ├── boundary.ts
        ├── leader.ts
        └── location.ts
```

## Completeness

| Area                    | Status |
|-------------------------|--------|
| SQL Schema + RLS + RPCs | ✅     |
| Locate API (PostGIS)    | ✅     |
| Leaders API + 409       | ✅     |
| AI Router (zero PII)    | ✅     |
| Offline Turf + SW       | ✅     |
| Public UI + 15 errors   | ✅     |
| Admin Login + Dashboard | ✅     |
| Optimistic Locking UI   | ✅     |
| Ingest script           | ✅     |
| Deployment guide        | ✅     |

All paths use the `@/` TypeScript alias defined in `tsconfig.json`.
