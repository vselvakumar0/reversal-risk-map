// Reversal Risk Map: indicator pipeline for Google Earth Engine (Code Editor).
//
// Computes four hazard indicators per region and exports one CSV to Google Drive.
// Then run pipeline/build_scores.py on that CSV to produce data/scores.json.
//
// SETUP
// 1. In the Code Editor: Assets > New > Shape files, upload pipeline/regions_admin1.zip
//    from this repository (about 4,600 states and provinces, same IDs as the site).
// 2. Put the asset ID below, paste this script, Run, then start the task in the Tasks tab.
//    With this many regions the export can take an hour or more.

var REGIONS_ASSET = 'projects/risk-map-515000/assets/regions_admin1';
var ID_FIELD = 'adm1_code';   // must match the "id" used in data/regions.geojson
var START = 2001;             // fire and drought period
var END = 2023;
var CYCLONE_START = 1980;
var CYCLONE_BUFFER_M = 100000; // storms within 100 km count as exposure
var HURRICANE_KT = 64;         // 1-minute sustained wind, knots

var regions = ee.FeatureCollection(REGIONS_ASSET);
var years = ee.List.sequence(START, END);

// 1. FIRE HISTORY
// Fraction of land burned in an average year (MODIS burned area, 500 m).
var burnDate = ee.ImageCollection('MODIS/061/MCD64A1').select('BurnDate');
var annualBurn = ee.ImageCollection.fromImages(years.map(function (y) {
  y = ee.Number(y);
  return burnDate.filter(ee.Filter.calendarRange(y, y, 'year'))
    .max().gt(0).unmask(0).rename('fire');
}));
var fire = annualBurn.mean().multiply(100); // % of land burned per year

// 2. DROUGHT TREND
// Slope of annual mean Palmer Drought Severity Index (TerraClimate).
// Sign is flipped so positive = drying.
var pdsi = ee.ImageCollection('IDAHO_EPSCOR/TERRACLIMATE').select('pdsi');
var annualPdsi = ee.ImageCollection.fromImages(years.map(function (y) {
  y = ee.Number(y);
  var mean = pdsi.filter(ee.Filter.calendarRange(y, y, 'year')).mean().multiply(0.01);
  return ee.Image.constant(y).toFloat().rename('year').addBands(mean.rename('pdsi'));
}));
var drought = annualPdsi.reduce(ee.Reducer.linearFit())
  .select('scale').multiply(-1).rename('drought');

// Regional means of fire and drought.
var step1 = fire.addBands(drought).reduceRegions({
  collection: regions,
  reducer: ee.Reducer.mean(),
  scale: 2000,
  tileScale: 8
});

// 3. DEFORESTATION PRESSURE
// Area of year-2000 forest (canopy >= 30%) and area of it lost in the last 10 years.
// Note: Hansen loss includes fire and harvest, not only permanent deforestation.
var gfc = ee.Image('UMD/hansen/global_forest_change_2023_v1_11');
var forest2000 = gfc.select('treecover2000').gte(30);
var recentLoss = gfc.select('lossyear').gte(END - 2000 - 9).and(forest2000);
var km2 = ee.Image.pixelArea().divide(1e6);
var forestBands = recentLoss.multiply(km2).rename('loss_km2')
  .addBands(forest2000.multiply(km2).rename('forest_km2'));

var step2 = forestBands.reduceRegions({
  collection: step1,
  reducer: ee.Reducer.sum(),
  scale: 500,        // coarser than the 30 m source: fine for regional totals, faster to run
  tileScale: 8
});

// 4. CYCLONE EXPOSURE
// Hurricane-force track points within 100 km of the region, per year,
// per 100,000 km2 of the buffered region.
// If this returns zero everywhere, print(storms.first()) and check the property names.
var storms = ee.FeatureCollection('NOAA/IBTrACS/v4')
  .filter(ee.Filter.gte('SEASON', CYCLONE_START))
  .filter(ee.Filter.gte('USA_WIND', HURRICANE_KT));
var nYears = END - CYCLONE_START + 1;

var result = step2.map(function (f) {
  var zone = f.geometry().buffer(CYCLONE_BUFFER_M, 10000);
  var count = storms.filterBounds(zone).size();
  var area = zone.area(10000).divide(1e11); // units of 100,000 km2
  return f.set('cyclone', ee.Number(count).divide(nYears).divide(area))
          .setGeometry(null);
});

print('First region', result.first());

Export.table.toDrive({
  collection: result,
  description: 'reversal_risk_indicators',
  fileFormat: 'CSV',
  selectors: [ID_FIELD, 'fire', 'drought', 'cyclone', 'loss_km2', 'forest_km2']
});
