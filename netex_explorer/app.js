/**
 * NeTEx Map Explorer
 * A DuckDB WASM-powered explorer for NeTEx parquet data
 */

// GCS bucket base URL
const GCS_BASE = 'https://storage.googleapis.com/netex-parquet-dev/aggregated';

// State
let db = null;
let conn = null;
let map = null;
let stopPlacesLayer = null;
let quaysLayer = null;
let linesLayer = null;
let currentImportTs = null;

// DOM Elements
const loadingOverlay = document.getElementById('loading-overlay');
const loadingStatus = document.getElementById('loading-status');
const progressFill = document.getElementById('progress-fill');

// Update loading progress
function updateProgress(percent, status) {
    progressFill.style.width = `${percent}%`;
    if (status) {
        loadingStatus.textContent = status;
    }
}

// Initialize the application
async function init() {
    try {
        updateProgress(5, 'Loading DuckDB WASM...');

        // Dynamically import DuckDB WASM
        const duckdb = await import('https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm');

        updateProgress(15, 'Initializing DuckDB...');

        // Select bundle based on browser features
        const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
        const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

        const worker_url = URL.createObjectURL(
            new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
        );

        const worker = new Worker(worker_url);
        const logger = new duckdb.ConsoleLogger();
        db = new duckdb.AsyncDuckDB(logger, worker);

        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        URL.revokeObjectURL(worker_url);

        updateProgress(30, 'Connecting to database...');
        conn = await db.connect();

        // Install and load httpfs for remote parquet files
        updateProgress(35, 'Setting up HTTP access...');
        await conn.query(`INSTALL httpfs`);
        await conn.query(`LOAD httpfs`);

        // Set S3 region for GCS compatibility (GCS uses S3-compatible API)
        await conn.query(`SET s3_region='auto'`);

        updateProgress(40, 'Discovering available data...');

        // Find the latest import timestamp by listing available files
        currentImportTs = await discoverLatestImport();

        updateProgress(50, 'Initializing map...');
        initMap();

        updateProgress(60, 'Loading entity types...');
        await loadEntityTypes();

        updateProgress(70, 'Loading stop places...');
        await loadStopPlaces();

        updateProgress(90, 'Setting up UI...');
        setupUI();

        updateProgress(100, 'Ready!');

        // Hide loading overlay
        setTimeout(() => {
            loadingOverlay.classList.add('hidden');
        }, 500);

    } catch (error) {
        console.error('Initialization error:', error);
        loadingStatus.textContent = `Error: ${error.message}`;
        loadingStatus.style.color = '#ef4444';
    }
}

// Discover the latest import timestamp
async function discoverLatestImport() {
    try {
        // Use GCS JSON API to list import timestamps
        const listUrl = 'https://storage.googleapis.com/storage/v1/b/netex-parquet-dev/o?prefix=aggregated/import_ts=&delimiter=/&maxResults=100';
        const response = await fetch(listUrl);

        if (response.ok) {
            const data = await response.json();
            if (data.prefixes && data.prefixes.length > 0) {
                // Prefixes are like "aggregated/import_ts=1769634342720933/"
                // Extract timestamps and find the latest (highest number)
                const timestamps = data.prefixes
                    .map(p => {
                        const match = p.match(/import_ts=(\d+)/);
                        return match ? match[1] : null;
                    })
                    .filter(Boolean)
                    .sort((a, b) => BigInt(b) - BigInt(a)); // Sort descending

                if (timestamps.length > 0) {
                    const latestTs = timestamps[0];
                    // Convert microseconds to date for display
                    const dateMs = Number(BigInt(latestTs) / 1000n);
                    const date = new Date(dateMs);
                    document.getElementById('import-date').textContent = date.toISOString().replace('T', ' ').slice(0, 19);
                    console.log(`Found ${timestamps.length} imports, using latest: ${latestTs}`);
                    return latestTs;
                }
            }
        }
    } catch (e) {
        console.error('Error discovering imports:', e);
    }

    // Fallback to a known recent timestamp
    const fallback = '1769634342720933';
    const dateMs = Number(BigInt(fallback) / 1000n);
    const date = new Date(dateMs);
    document.getElementById('import-date').textContent = date.toISOString().replace('T', ' ').slice(0, 19);
    return fallback;
}

// Get parquet URL for a table
function getParquetUrl(tableName) {
    return `${GCS_BASE}/import_ts=${currentImportTs}/${tableName}.parquet`;
}

// Initialize Leaflet map
function initMap() {
    // Center on Norway
    map = L.map('map', {
        center: [64.5, 11.0],
        zoom: 5,
        zoomControl: true
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    // Initialize cluster layers
    stopPlacesLayer = L.markerClusterGroup({
        chunkedLoading: true,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        maxClusterRadius: 50,
        iconCreateFunction: function(cluster) {
            const count = cluster.getChildCount();
            let size = 'small';
            if (count > 100) size = 'large';
            else if (count > 10) size = 'medium';

            return L.divIcon({
                html: `<div>${count}</div>`,
                className: `marker-cluster marker-cluster-${size}`,
                iconSize: L.point(40, 40)
            });
        }
    });

    quaysLayer = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 30,
        disableClusteringAtZoom: 15
    });

    linesLayer = L.layerGroup();

    // Add stop places layer by default
    map.addLayer(stopPlacesLayer);

    // Zoom to Norway button
    document.getElementById('zoom-to-norway').addEventListener('click', () => {
        map.setView([64.5, 11.0], 5);
    });
}

// Load entity types
async function loadEntityTypes() {
    try {
        const result = await conn.query(`
            SELECT entity_type, COUNT(*) as count
            FROM read_parquet('${getParquetUrl('entities')}')
            GROUP BY entity_type
            ORDER BY count DESC
            LIMIT 30
        `);

        const rows = result.toArray();
        const container = document.getElementById('entity-types');
        container.innerHTML = '';

        let totalCount = 0;
        rows.forEach(row => {
            const type = row.entity_type;
            const count = Number(row.count);
            totalCount += count;

            const tag = document.createElement('span');
            tag.className = 'entity-type-tag';
            tag.textContent = `${type} (${count.toLocaleString()})`;
            tag.dataset.type = type;
            tag.addEventListener('click', () => {
                tag.classList.toggle('active');
                filterByEntityType(type, tag.classList.contains('active'));
            });
            container.appendChild(tag);
        });

        document.getElementById('entity-count').textContent = totalCount.toLocaleString();

    } catch (error) {
        console.error('Error loading entity types:', error);
        document.getElementById('entity-types').innerHTML =
            `<p class="error-message">Error loading types: ${error.message}</p>`;
    }
}

// Load stop places with coordinates
async function loadStopPlaces() {
    try {
        updateProgress(72, 'Querying stop places...');

        // Query to get stop places with their coordinates
        // NeTEx stores coordinates in entity_values or as attributes
        const result = await conn.query(`
            WITH stop_entities AS (
                SELECT
                    e.entity_id,
                    e.entity_type,
                    e.codespace_id
                FROM read_parquet('${getParquetUrl('entities')}') e
                WHERE e.entity_type IN ('StopPlace', 'Quay')
                LIMIT 50000
            ),
            entity_names AS (
                SELECT
                    ev.entity_id,
                    ev.value as name
                FROM read_parquet('${getParquetUrl('entity_values')}') ev
                WHERE ev.attribute = 'Name'
            ),
            entity_lats AS (
                SELECT
                    ev.entity_id,
                    TRY_CAST(ev.value AS DOUBLE) as latitude
                FROM read_parquet('${getParquetUrl('entity_values')}') ev
                WHERE ev.attribute = 'Latitude'
                  AND TRY_CAST(ev.value AS DOUBLE) IS NOT NULL
            ),
            entity_lons AS (
                SELECT
                    ev.entity_id,
                    TRY_CAST(ev.value AS DOUBLE) as longitude
                FROM read_parquet('${getParquetUrl('entity_values')}') ev
                WHERE ev.attribute = 'Longitude'
                  AND TRY_CAST(ev.value AS DOUBLE) IS NOT NULL
            )
            SELECT
                se.entity_id,
                se.entity_type,
                se.codespace_id,
                en.name,
                el.latitude,
                elo.longitude
            FROM stop_entities se
            LEFT JOIN entity_names en ON se.entity_id = en.entity_id
            LEFT JOIN entity_lats el ON se.entity_id = el.entity_id
            LEFT JOIN entity_lons elo ON se.entity_id = elo.entity_id
            WHERE el.latitude IS NOT NULL
              AND elo.longitude IS NOT NULL
              AND el.latitude BETWEEN 57 AND 72
              AND elo.longitude BETWEEN 4 AND 32
        `);

        const rows = result.toArray();

        updateProgress(80, `Processing ${rows.length} locations...`);

        let stopCount = 0;
        let quayCount = 0;
        const markers = [];
        const quayMarkers = [];

        rows.forEach(row => {
            const lat = row.latitude;
            const lon = row.longitude;
            const name = row.name || row.entity_id;
            const type = row.entity_type;
            const entityId = row.entity_id;

            if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
                const marker = L.circleMarker([lat, lon], {
                    radius: type === 'StopPlace' ? 6 : 4,
                    fillColor: type === 'StopPlace' ? '#2563eb' : '#10b981',
                    color: '#ffffff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                });

                marker.bindPopup(`
                    <h4>${name}</h4>
                    <p><strong>Type:</strong> ${type}</p>
                    <p><strong>ID:</strong> ${entityId}</p>
                    <p><strong>Coordinates:</strong> ${lat.toFixed(5)}, ${lon.toFixed(5)}</p>
                `);

                marker.on('click', () => showEntityDetails(entityId, name, type, lat, lon));

                if (type === 'StopPlace') {
                    markers.push(marker);
                    stopCount++;
                } else {
                    quayMarkers.push(marker);
                    quayCount++;
                }
            }
        });

        // Add markers to layers
        stopPlacesLayer.addLayers(markers);
        quaysLayer.addLayers(quayMarkers);

        // Update counts
        document.getElementById('stops-count').textContent = stopCount.toLocaleString();
        document.getElementById('quays-count').textContent = quayCount.toLocaleString();

        console.log(`Loaded ${stopCount} stop places and ${quayCount} quays`);

    } catch (error) {
        console.error('Error loading stop places:', error);
        document.getElementById('stops-count').textContent = 'Error';
    }
}

// Load lines
async function loadLines() {
    try {
        const result = await conn.query(`
            SELECT
                e.entity_id,
                e.entity_type,
                e.codespace_id
            FROM read_parquet('${getParquetUrl('entities')}') e
            WHERE e.entity_type = 'Line'
            LIMIT 1000
        `);

        const rows = result.toArray();
        document.getElementById('lines-count').textContent = rows.length.toLocaleString();

        // Lines don't have direct geometry - they're defined through ServiceJourneyPatterns
        // For now, just count them

    } catch (error) {
        console.error('Error loading lines:', error);
        document.getElementById('lines-count').textContent = 'Error';
    }
}

// Show entity details in sidebar
async function showEntityDetails(entityId, name, type, lat, lon) {
    const panel = document.getElementById('details-panel');
    const details = document.getElementById('entity-details');

    panel.style.display = 'block';

    details.innerHTML = `
        <h4>${name}</h4>
        <div class="detail-row">
            <span class="detail-label">Type</span>
            <span class="detail-value">${type}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Entity ID</span>
            <span class="detail-value">${entityId}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Latitude</span>
            <span class="detail-value">${lat?.toFixed(6) || 'N/A'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Longitude</span>
            <span class="detail-value">${lon?.toFixed(6) || 'N/A'}</span>
        </div>
        <p class="loading-text" id="loading-more-details">Loading additional details...</p>
    `;

    // Load additional details
    try {
        const valuesResult = await conn.query(`
            SELECT attribute, value
            FROM read_parquet('${getParquetUrl('entity_values')}')
            WHERE entity_id = '${entityId}'
            LIMIT 20
        `);

        const values = valuesResult.toArray();
        const loadingEl = document.getElementById('loading-more-details');

        if (values.length > 0) {
            let additionalHtml = '';
            values.forEach(row => {
                if (row.attribute !== 'Name' && row.attribute !== 'Latitude' && row.attribute !== 'Longitude') {
                    additionalHtml += `
                        <div class="detail-row">
                            <span class="detail-label">${row.attribute}</span>
                            <span class="detail-value">${row.value || 'N/A'}</span>
                        </div>
                    `;
                }
            });
            loadingEl.outerHTML = additionalHtml || '<p class="loading-text">No additional attributes</p>';
        } else {
            loadingEl.textContent = 'No additional attributes';
        }
    } catch (error) {
        console.error('Error loading entity details:', error);
        document.getElementById('loading-more-details').textContent = 'Error loading details';
    }
}

// Filter by entity type
function filterByEntityType(type, active) {
    console.log(`Filter by ${type}: ${active}`);
    // For now, just log - full implementation would filter the map
}

// Search stop places
async function searchStopPlaces(query) {
    const resultsContainer = document.getElementById('search-results');

    if (!query || query.length < 2) {
        resultsContainer.innerHTML = '';
        return;
    }

    resultsContainer.innerHTML = '<p class="loading-text">Searching...</p>';

    try {
        const result = await conn.query(`
            WITH stop_entities AS (
                SELECT entity_id, entity_type
                FROM read_parquet('${getParquetUrl('entities')}')
                WHERE entity_type IN ('StopPlace', 'Quay')
            ),
            entity_names AS (
                SELECT entity_id, value as name
                FROM read_parquet('${getParquetUrl('entity_values')}')
                WHERE attribute = 'Name'
                  AND LOWER(value) LIKE LOWER('%${query.replace(/'/g, "''")}%')
            ),
            entity_lats AS (
                SELECT entity_id, TRY_CAST(value AS DOUBLE) as latitude
                FROM read_parquet('${getParquetUrl('entity_values')}')
                WHERE attribute = 'Latitude'
            ),
            entity_lons AS (
                SELECT entity_id, TRY_CAST(value AS DOUBLE) as longitude
                FROM read_parquet('${getParquetUrl('entity_values')}')
                WHERE attribute = 'Longitude'
            )
            SELECT
                se.entity_id,
                se.entity_type,
                en.name,
                el.latitude,
                elo.longitude
            FROM stop_entities se
            INNER JOIN entity_names en ON se.entity_id = en.entity_id
            LEFT JOIN entity_lats el ON se.entity_id = el.entity_id
            LEFT JOIN entity_lons elo ON se.entity_id = elo.entity_id
            WHERE el.latitude IS NOT NULL AND elo.longitude IS NOT NULL
            LIMIT 20
        `);

        const rows = result.toArray();

        if (rows.length === 0) {
            resultsContainer.innerHTML = '<p class="loading-text">No results found</p>';
            return;
        }

        resultsContainer.innerHTML = rows.map(row => `
            <div class="search-result-item"
                 data-lat="${row.latitude}"
                 data-lon="${row.longitude}"
                 data-id="${row.entity_id}"
                 data-name="${row.name}"
                 data-type="${row.entity_type}">
                <div class="search-result-name">${row.name}</div>
                <div class="search-result-type">${row.entity_type} - ${row.entity_id}</div>
            </div>
        `).join('');

        // Add click handlers
        resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const lat = parseFloat(item.dataset.lat);
                const lon = parseFloat(item.dataset.lon);
                const name = item.dataset.name;
                const type = item.dataset.type;
                const id = item.dataset.id;

                map.setView([lat, lon], 15);
                showEntityDetails(id, name, type, lat, lon);

                // Create temporary marker
                L.popup()
                    .setLatLng([lat, lon])
                    .setContent(`<h4>${name}</h4><p>${type}</p>`)
                    .openOn(map);
            });
        });

    } catch (error) {
        console.error('Search error:', error);
        resultsContainer.innerHTML = `<p class="error-message">Search error: ${error.message}</p>`;
    }
}

// Run custom SQL query
async function runQuery(sql) {
    const resultsContainer = document.getElementById('query-results');
    resultsContainer.innerHTML = '<p class="loading-text">Running query...</p>';

    try {
        // Replace table names with parquet URLs
        let processedSql = sql
            .replace(/FROM\s+entities/gi, `FROM read_parquet('${getParquetUrl('entities')}')`)
            .replace(/FROM\s+entity_values/gi, `FROM read_parquet('${getParquetUrl('entity_values')}')`)
            .replace(/FROM\s+refs/gi, `FROM read_parquet('${getParquetUrl('refs')}')`)
            .replace(/FROM\s+entity_types/gi, `FROM read_parquet('${getParquetUrl('entity_types')}')`)
            .replace(/FROM\s+ref_types/gi, `FROM read_parquet('${getParquetUrl('ref_types')}')`)
            .replace(/FROM\s+codespaces/gi, `FROM read_parquet('${getParquetUrl('codespaces')}')`)
            .replace(/FROM\s+files/gi, `FROM read_parquet('${getParquetUrl('files')}')`);

        const result = await conn.query(processedSql);
        const rows = result.toArray();

        if (rows.length === 0) {
            resultsContainer.innerHTML = '<p class="loading-text">No results</p>';
            return;
        }

        // Build table
        const columns = Object.keys(rows[0]);
        let tableHtml = '<table><thead><tr>';
        columns.forEach(col => {
            tableHtml += `<th>${col}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';

        rows.forEach(row => {
            tableHtml += '<tr>';
            columns.forEach(col => {
                const value = row[col];
                const displayValue = value === null ? 'NULL' :
                    (typeof value === 'object' ? JSON.stringify(value) : String(value));
                tableHtml += `<td>${displayValue.substring(0, 100)}</td>`;
            });
            tableHtml += '</tr>';
        });

        tableHtml += '</tbody></table>';
        resultsContainer.innerHTML = tableHtml;

    } catch (error) {
        console.error('Query error:', error);
        resultsContainer.innerHTML = `<p class="error-message">Query error: ${error.message}</p>`;
    }
}

// Setup UI event handlers
function setupUI() {
    // Mobile menu
    const sidebar = document.getElementById('sidebar');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileClose = document.getElementById('mobile-close');

    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.add('open');
    });

    mobileClose.addEventListener('click', () => {
        sidebar.classList.remove('open');
    });

    // Layer toggles
    document.getElementById('layer-stops').addEventListener('change', (e) => {
        if (e.target.checked) {
            map.addLayer(stopPlacesLayer);
        } else {
            map.removeLayer(stopPlacesLayer);
        }
    });

    document.getElementById('layer-quays').addEventListener('change', (e) => {
        if (e.target.checked) {
            map.addLayer(quaysLayer);
        } else {
            map.removeLayer(quaysLayer);
        }
    });

    document.getElementById('layer-lines').addEventListener('change', async (e) => {
        if (e.target.checked) {
            await loadLines();
            map.addLayer(linesLayer);
        } else {
            map.removeLayer(linesLayer);
        }
    });

    // Search
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');

    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchStopPlaces(searchInput.value);
        }, 300);
    });

    searchBtn.addEventListener('click', () => {
        searchStopPlaces(searchInput.value);
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchStopPlaces(searchInput.value);
        }
    });

    // Collapsible panels
    document.querySelectorAll('.panel-header[data-toggle]').forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.dataset.toggle;
            const body = document.getElementById(targetId);
            const icon = header.querySelector('.toggle-icon');

            body.classList.toggle('collapsed');
            icon.textContent = body.classList.contains('collapsed') ? '+' : '-';
        });
    });

    // Query console
    document.getElementById('run-query').addEventListener('click', () => {
        const sql = document.getElementById('sql-input').value;
        if (sql.trim()) {
            runQuery(sql);
        }
    });

    document.getElementById('clear-query').addEventListener('click', () => {
        document.getElementById('sql-input').value = '';
        document.getElementById('query-results').innerHTML = '';
    });

    // Example queries in SQL input placeholder
    document.getElementById('sql-input').value =
        "SELECT entity_type, COUNT(*) as count\nFROM entities\nGROUP BY entity_type\nORDER BY count DESC\nLIMIT 10";
}

// Initialize on load
init();
