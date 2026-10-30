# Production location verification (tap-only)

Use the map pin to test these six points. Coordinates are interior points from the current official boundary dataset; expected village is the geometric source label, not a promise that an approximate phone GPS fix will return it as top-1.

| District | Expected village | Latitude | Longitude |
|---|---|---:|---:|
| Gasabo | Gatagara | -1.881187 | 30.100540 |
| Huye | Kabeza | -2.596485 | 29.718616 |
| Musanze | Ntebe | -1.445951 | 29.655421 |
| Rubavu | Abahuje | -1.675781 | 29.256532 |
| Rusizi | Ruvuruga | -2.583725 | 28.991402 |
| Rwamagana | Rusave | -2.025512 | 30.255142 |

For each row: open Production; tap the map pin; move the pin to the coordinate if the map supports numeric coordinate entry, otherwise visit the location in person and tap “Menya aho ndi.” Record the village shown, sector/cell, source label (GPS/map/nearest), whether the village picker remains available, and any error. Do not enter passwords or keys in the test report.

Interpretation: “nearest” is an estimate and must be manually checked. A GPS fix is not expected to match an exact point if reported accuracy is poor. A result is a pass only when the expected village is shown as the best candidate or within the offered candidates and the UI still allows confirmation/change. An error with no available picker is a fail. Repeat on 3–4 districts first; six points are a broader checklist, not proof of nationwide accuracy.
