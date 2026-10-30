# Production location verification (tap-only)

PR #2 remains unmerged. Run these checks only after the owner updates the Production Supabase URL, public key, and server-only key to the same populated project and redeploys. Never paste keys or passwords into the report.

These six coordinates were sampled from active village polygons and each returned the expected village as top-1 through the Preview `/api/locate` smoke test (20 m accuracy). They are test coordinates, not the device user's actual location. Move the map marker to each coordinate where practical; do not confuse map-pin testing with a GPS test.

| District | Sector | Cell | Expected village | Latitude | Longitude | Expected scope code |
|---|---|---|---|---:|---:|---|
| Gasabo | Rusororo | Mbandazi | Karambo | -1.906745 | 30.222255 | RW-P1-D12-S1214-C121406-V12140602 |
| Huye | Rusatira | Kiruhura | Rubona | -2.485157 | 29.775463 | RW-P2-D24-S2411-C241105-V24110507 |
| Musanze | Kinigi | Nyabigoma | Mitobo | -1.405507 | 29.578917 | RW-P4-D43-S4307-C430704-V43070406 |
| Nyagatare | Karangazi | Ndama | Akayange | -1.390677 | 30.582210 | RW-P5-D52-S5203-C520306-V52030601 |
| Nyarugenge | Mageregere | Mataba | Rushubi | -2.059884 | 30.067102 | RW-P1-D11-S1105-C110503-V11050308 |
| Rubavu | Kanama | Karambo | Mariba | -1.706059 | 29.418710 | RW-P3-D33-S3305-C330502-V33050202 |

## Steps on the phone

1. Open Production after the redeploy. Tap the map-pin button and move the marker to one test coordinate using map panning/zooming; submit it.
2. Compare the displayed expected village and its sector/cell against the row. Record whether the source says map/GPS/nearest, whether uncertainty is honestly shown, and whether the picker remains available.
3. Repeat for all six if possible. For a real GPS test, only use “Menya aho ndi” when physically at the location; a map coordinate is not evidence of GPS accuracy.
4. Also tap “Menya aho ndi” at your real location in 3–4 districts. Record only district/sector/cell/village, source label, error code if any, and whether you could manually choose a village. Do not send precise home coordinates, phone numbers, accounts, or keys.

## How to read the result

- **Pass for a test coordinate:** the expected village is shown as the first candidate or among candidates, its sector/cell match, and you can confirm/change the village.
- **Needs review:** a different village is top-1 but the expected village is among candidates, or the result is labelled `nearest`. Confirm manually; nearest is only an estimate.
- **Fail:** no village candidate and no way to use the manual picker, or the UI ends with an error.
- This six-point list and a few field taps do not prove nationwide accuracy. The current Preview test on commit `1cd3f2ea8ece5a9edafba15a5e310a8119c00a0c` is older than the current PR head, so repeat after a fresh Preview deploy and again after the owner's Production redeploy.
