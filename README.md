# Reversal Risk Map

An interactive map that scores states and provinces on the risk that carbon stored in forests and mangroves is lost again. Four hazards go into the score: fire history, drought trend, cyclone exposure and deforestation pressure. Carbon projects can be switched on as an extra layer, to compare a region's risk with the buffer each project sets aside.

> **Status: the scores in `data/scores.json` are placeholders.** They were generated arbitrarily so the site can be previewed, and the site shows a banner saying so. Run the pipeline below to replace them with real results. The banner disappears on its own once you do.

## Publish on GitHub Pages

1. Create a new repository and upload everything in this folder.
2. In the repository: Settings > Pages > Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
3. The site appears at `https://YOUR_USERNAME.github.io/REPO_NAME/` after a minute or two.

To preview locally, run `python3 -m http.server` in this folder and open http://localhost:8000. Opening `index.html` directly from disk will not load the data files.

## Get real data

You need a free [Google Earth Engine](https://earthengine.google.com/) account.

1. Upload `pipeline/regions_admin1.zip` as an asset in the Earth Engine Code Editor (Assets > New > Shape files).
2. Open `pipeline/reversal_risk_gee.js`, set `REGIONS_ASSET` to your asset path, paste it into the Code Editor and run it. Start the export in the Tasks tab. With about 4,600 regions it can take an hour or more.
3. Download `reversal_risk_indicators.csv` from Google Drive and run:

   ```
   python3 pipeline/build_scores.py reversal_risk_indicators.csv
   ```

4. Commit the updated `data/scores.json`.

The Earth Engine script has not been run end to end yet. Check the first printed region for sensible values before exporting, and check dataset IDs against the Earth Engine catalog if anything fails to load.

## Method

| Indicator | Measure | Dataset |
|---|---|---|
| Fire history | % of land burned in an average year, 2001–2023 | MODIS MCD64A1 |
| Drought trend | Slope of annual Palmer Drought Severity Index, 2001–2023 (positive = drying) | TerraClimate |
| Cyclone exposure | Hurricane-force track points within 100 km per year since 1980, per 100,000 km² | NOAA IBTrACS v4 |
| Deforestation pressure | % of year-2000 forest (canopy ≥ 30%) lost 2014–2023 | Hansen Global Forest Change |

Each indicator is converted to 0–100 by ranking the region against all others. The overall score is the weighted average, with weights adjustable on the site. It is a relative ranking, not a probability of loss.

## Projects layer

`data/projects.json` lists example projects with approximate locations. Before publishing:

- Check each project's name, registry ID and status in its registry, then set `"verified": true`.
- Fill in `buffer_pct` from the project's non-permanence risk report or registry record.
- Replace the point with the real project location, or add more projects.

## Limits

- Regions are states and provinces (Natural Earth admin-1, simplified). Their size varies a lot between countries, and risk still varies inside large ones. To use other boundaries, supply any polygon file with the same ID field in both the Earth Engine asset and `data/regions.geojson`.
- Hansen forest loss includes fire and plantation harvest, so it overlaps with the fire indicator.
- Past hazard stands in for future hazard. Pests, disease, sea-level rise, tenure and political risk are not covered.

## Files

```
index.html                      the site
data/regions.geojson            state and province boundaries (Natural Earth, simplified)
data/scores.json                indicator values per region
data/projects.json              optional project layer
pipeline/regions_admin1.zip     the same boundaries as a shapefile, for Earth Engine
pipeline/reversal_risk_gee.js   Earth Engine script that computes the indicators
pipeline/build_scores.py        converts the export into data/scores.json
vendor/leaflet/                 Leaflet 1.9.4 (BSD 2-Clause)
```
