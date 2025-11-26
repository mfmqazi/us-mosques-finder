// State Management
const state = {
    map: null,
    markers: null, // MarkerClusterGroup
    currentLocation: null,
    isLoading: false,
    selectedMosque: null,
    searchTimeout: null,
    abortController: null
};

// Configuration
const CONFIG = {
    // Default to New York City for faster initial load
    defaultCenter: [40.7128, -74.0060], // NYC
    defaultZoom: 12, // City-level zoom instead of country-level
    minZoomForSearch: 9,
    overpassUrl: 'https://overpass-api.de/api/interpreter',
    fetchTimeout: 15000 // 15 seconds timeout for fetch
};

// Icons - Google Maps Style
const mosqueIcon = L.divIcon({
    className: 'custom-marker',
    html: `<div style="
        position: relative;
        width: 30px;
        height: 40px;
    ">
        <svg width="30" height="42" viewBox="0 0 30 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <path d="M15 0C6.71573 0 0 6.71573 0 15C0 26.25 15 42 15 42C15 42 30 26.25 30 15C30 6.71573 23.2843 0 15 0Z" fill="#EA4335"/>
            <circle cx="15" cy="15" r="5" fill="#B31412"/>
        </svg>
    </div>`,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -42]
});

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupEventListeners();
});

function initMap() {
    // Initialize Leaflet Map
    state.map = L.map('map', {
        zoomControl: false, // We'll add it in a custom position if needed, or default
        attributionControl: false // Cleaner look, but we should add attribution manually if needed
    }).setView(CONFIG.defaultCenter, CONFIG.defaultZoom);

    // Add Zoom Control to bottom right (Google Maps style)
    L.control.zoom({
        position: 'bottomright'
    }).addTo(state.map);

    // Add Tile Layer - CartoDB Voyager (Clean, Google-like)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(state.map);

    // Initialize Marker Cluster Group
    state.markers = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: function (cluster) {
            const count = cluster.getChildCount();
            let size = 'small';
            let color = '#4285F4'; // Google Blue

            if (count > 10) {
                size = 'medium';
                color = '#FBBC04'; // Google Yellow
            }
            if (count > 100) {
                size = 'large';
                color = '#EA4335'; // Google Red
            }

            return L.divIcon({
                html: `<div style="
                    background-color: ${color};
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: 2px solid white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                    font-family: var(--font-primary);
                ">${count}</div>`,
                className: 'custom-cluster-icon',
                iconSize: [40, 40]
            });
        }
    });
    state.map.addLayer(state.markers);

    state.map.on('moveend', () => {
        if (state.map.getZoom() >= CONFIG.minZoomForSearch) {
            // Debounce: Wait 1 second after user stops moving map
            if (state.searchTimeout) clearTimeout(state.searchTimeout);
            state.searchTimeout = setTimeout(() => {
                fetchMosquesInBounds();
            }, 1000);
        }
    });
}

function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');

    searchBtn.addEventListener('click', () => handleSearch(searchInput.value));
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch(searchInput.value);
    });

    document.getElementById('locate-btn').addEventListener('click', handleLocateMe);
    document.getElementById('close-panel').addEventListener('click', closePanel);

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });
}

// --- Core Logic ---

async function handleSearch(query) {
    if (!query) return;

    showLoading(true);
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=us`);
        const data = await response.json();

        if (data && data.length > 0) {
            const result = data[0];
            const lat = parseFloat(result.lat);
            const lon = parseFloat(result.lon);

            state.map.setView([lat, lon], 13);
            // Trigger fetch after move
        } else {
            showToast('Location not found.', 'warning');
        }
    } catch (error) {
        console.error('Search error:', error);
        showToast('An error occurred while searching.', 'error');
    } finally {
        showLoading(false);
    }
}

function handleLocateMe() {
    showLoading(true);
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                state.currentLocation = [latitude, longitude];
                state.map.setView([latitude, longitude], 13);
                showLoading(false);

                // Add user location marker
                L.circleMarker([latitude, longitude], {
                    radius: 8,
                    fillColor: "#4285F4",
                    color: "#fff",
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 1
                }).addTo(state.map).bindPopup("You are here").openPopup();
            },
            (error) => {
                console.error("Geolocation error:", error);
                showLoading(false);
                showToast("Could not get your location.", 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    } else {
        showLoading(false);
        showToast("Geolocation is not supported by your browser.", 'error');
    }
}

async function fetchMosquesInBounds() {
    if (state.abortController) {
        state.abortController.abort();
    }
    state.abortController = new AbortController();
    const signal = state.abortController.signal;

    const bounds = state.map.getBounds();
    const south = bounds.getSouth();
    const west = bounds.getWest();
    const north = bounds.getNorth();
    const east = bounds.getEast();

    const center = state.map.getCenter();
    const centerLat = center.lat;
    const centerLng = center.lng;

    showLoading(true);

    try {
        // Run both fetches in parallel to speed up loading
        const [masjidiOutcome, osmOutcome] = await Promise.allSettled([
            fetchFromMasjidiAPI(centerLat, centerLng, signal),
            fetchFromOpenStreetMap(south, west, north, east, signal)
        ]);

        const masjidiResults = masjidiOutcome.status === 'fulfilled' ? masjidiOutcome.value : [];
        const osmResults = osmOutcome.status === 'fulfilled' ? osmOutcome.value : [];

        // Combine and deduplicate results
        const allResults = [...masjidiResults, ...osmResults];
        const uniqueResults = deduplicateMosques(allResults);

        updateMarkers(uniqueResults);
        updateCounts(uniqueResults.length);

    } catch (error) {
        if (error.name === 'AbortError') {
            return;
        }
        console.error('Error fetching mosques:', error);
        showToast('Failed to load some mosques. Showing available data.', 'warning');
    } finally {
        if (!signal.aborted) {
            showLoading(false);
        }
        state.abortController = null;
    }
}

async function fetchFromMasjidiAPI(lat, lng, signal) {
    try {
        const dist = 50; // 50km radius
        const limit = 100; // Maximum allowed by server

        // Use our live Render proxy
        const endpoint = `https://us-mosques-finder.onrender.com/api/masjids?lat=${lat}&long=${lng}&dist=${dist}&limit=${limit}`;

        // Add a 10s timeout specifically for MasjidiAPI
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('MasjidiAPI timeout')), 10000)
        );

        const fetchPromise = fetch(endpoint, { signal: signal });

        const response = await Promise.race([fetchPromise, timeoutPromise]);

        if (response.ok) {
            const data = await response.json();
            console.log('MasjidiAPI response via proxy:', data);

            // Transform MasjidiAPI data to our format
            return transformMasjidiData(data);
        } else {
            console.warn('Proxy returned status:', response.status);
            return [];
        }
    } catch (error) {
        if (error.name === 'AbortError') return [];
        console.warn('MasjidiAPI proxy unavailable/timeout, using OSM only:', error);
        return [];
    }
}

async function fetchFromOpenStreetMap(south, west, north, east, signal) {
    const query = `
        [out:json][timeout:60];
        (
          nwr["amenity"="place_of_worship"]["religion"="muslim"](${south},${west},${north},${east});
          nwr["amenity"="place_of_worship"]["religion"="islam"](${south},${west},${north},${east});
          nwr["amenity"="community_centre"]["religion"="muslim"](${south},${west},${north},${east});
          nwr["amenity"="community_centre"]["religion"="islam"](${south},${west},${north},${east});
          nwr["building"="mosque"](${south},${west},${north},${east});
          nwr["office"="religious"]["religion"="muslim"](${south},${west},${north},${east});
          nwr["office"="religious"]["religion"="islam"](${south},${west},${north},${east});
          nwr["name"~"Mosque|Masjid|Masjed|Islamic Center|Islamic Centre|Muslim Community|Musalla|Musallah|Jamia|Jami|Prayer Hall|Prayer Room|Islamic Society|Islamic Foundation|Islamic Association|Dar al|Darul",i](${south},${west},${north},${east});
          nwr["building"]["name"~"Mosque|Masjid|Islamic",i](${south},${west},${north},${east});
        );
        out center;
    `;

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out')), CONFIG.fetchTimeout);
    });

    try {
        const fetchPromise = fetch(CONFIG.overpassUrl, {
            method: 'POST',
            body: 'data=' + encodeURIComponent(query),
            signal: signal
        });

        const response = await Promise.race([fetchPromise, timeoutPromise]);

        if (!response.ok) throw new Error('OSM API Error');

        const data = await response.json();
        return data.elements || [];

    } catch (error) {
        if (error.name === 'AbortError') {
            throw error;
        }
        console.warn('OpenStreetMap error:', error);
        return [];
    }
}

function transformMasjidiData(data) {
    // Transform MasjidiAPI response to match OSM format
    // This will need adjustment based on actual API response
    if (!data) return [];

    const masjids = Array.isArray(data) ? data : (data.masjids || data.results || []);

    return masjids.map(masjid => ({
        type: 'node',
        lat: masjid.latitude || masjid.lat,
        lon: masjid.longitude || masjid.lng || masjid.lon,
        tags: {
            name: masjid.name || masjid.title, // Fallback to title if name is missing
            'addr:street': masjid.address || masjid.street,
            'addr:city': masjid.city,
            'addr:state': masjid.state,
            'addr:postcode': masjid.zipCode || masjid.zip,
            phone: masjid.phone || masjid.phoneNumber,
            website: masjid.website,
            amenity: 'place_of_worship',
            religion: 'muslim',
            source: 'MasjidiAPI'
        }
    }));
}

function deduplicateMosques(mosques) {
    const seen = new Map();
    const threshold = 0.0001; // ~11 meters

    return mosques.filter(mosque => {
        let lat, lon;
        if (mosque.type === 'node') {
            lat = mosque.lat;
            lon = mosque.lon;
        } else if (mosque.center) {
            lat = mosque.center.lat;
            lon = mosque.center.lon;
        } else {
            return false;
        }

        // Check if we've seen a mosque at this location
        const key = `${Math.round(lat / threshold)}_${Math.round(lon / threshold)}`;

        if (seen.has(key)) {
            // Prefer MasjidiAPI data over OSM
            const existing = seen.get(key);
            if (mosque.tags?.source === 'MasjidiAPI' && existing.tags?.source !== 'MasjidiAPI') {
                seen.set(key, mosque);
                return false; // Will be added as the preferred version
            }
            return false; // Duplicate
        }

        seen.set(key, mosque);
        return true;
    });
}

function updateMarkers(elements) {
    state.markers.clearLayers();
    const newMarkers = [];

    elements.forEach(element => {
        let lat, lon;
        if (element.type === 'node') {
            lat = element.lat;
            lon = element.lon;
        } else if (element.center) {
            lat = element.center.lat;
            lon = element.center.lon;
        } else {
            return;
        }

        const marker = L.marker([lat, lon], { icon: mosqueIcon })
            .on('click', () => showMosqueDetails(element));

        newMarkers.push(marker);
    });

    state.markers.addLayers(newMarkers);
}

function updateCounts(total) {
    const elAll = document.getElementById('count-all');
    const elMosque = document.getElementById('count-mosque');
    const elCenter = document.getElementById('count-center');

    if (elAll) elAll.textContent = total;
    if (elMosque) elMosque.textContent = total;
    if (elCenter) elCenter.textContent = 0;
}

// --- UI & Data Mocking ---

function showMosqueDetails(data) {
    const panel = document.getElementById('info-panel');
    const content = document.getElementById('panel-content');
    const prayerTimes = generateMockPrayerTimes();

    const name = data.tags.name || data.tags['name:en'] || 'Unknown Mosque';
    const address = formatAddress(data.tags);

    content.innerHTML = `
        <div class="panel-header">
            <h2 class="panel-title">${name}</h2>
            <p class="panel-subtitle">${address}</p>
        </div>
        <div class="panel-section">
            <div class="panel-section-title">Today's Prayer Times</div>
            <div class="prayer-times-grid">
                ${renderPrayerTimeCard('Fajr', prayerTimes.fajr)}
                ${renderPrayerTimeCard('Dhuhr', prayerTimes.dhuhr)}
                ${renderPrayerTimeCard('Asr', prayerTimes.asr)}
                ${renderPrayerTimeCard('Maghrib', prayerTimes.maghrib)}
                ${renderPrayerTimeCard('Isha', prayerTimes.isha)}
                ${renderPrayerTimeCard('Jumuah', prayerTimes.jumuah, true)}
            </div>
        </div>
        <div class="panel-section">
            <div class="panel-section-title">Contact Info</div>
            <div class="contact-info">
                ${data.tags.phone ? `<a href="tel:${data.tags.phone}" class="contact-item"><span>${data.tags.phone}</span></a>` : ''}
                ${data.tags.website ? `<a href="${data.tags.website}" target="_blank" class="contact-item"><span>Visit Website</span></a>` : ''}
                <div class="contact-item"><span>Get Directions</span></div>
            </div>
        </div>
    `;
    panel.classList.add('active');
}

function renderPrayerTimeCard(name, times, isJumuah = false) {
    return `
        <div class="prayer-time-card">
            <div class="prayer-name">${name}</div>
            <div class="prayer-times">
                <div class="prayer-time-item"><span class="prayer-time-label">Adhan</span><span class="prayer-time-value">${times.adhan}</span></div>
                <div class="prayer-time-item"><span class="prayer-time-label">Iqama</span><span class="prayer-time-value iqama-time">${times.iqama}</span></div>
            </div>
        </div>
    `;
}

function closePanel() {
    document.getElementById('info-panel').classList.remove('active');
}

function formatAddress(tags) {
    const parts = [];
    if (tags['addr:street']) parts.push(tags['addr:street']);
    if (tags['addr:city']) parts.push(tags['addr:city']);
    if (tags['addr:state']) parts.push(tags['addr:state']);
    if (tags['addr:postcode']) parts.push(tags['addr:postcode']);

    return parts.length > 0 ? parts.join(', ') : 'Address not available';
}

function generateMockPrayerTimes() {
    // In a real app, this would come from the API
    return {
        fajr: { adhan: '5:30 AM', iqama: '6:00 AM' },
        dhuhr: { adhan: '1:15 PM', iqama: '1:30 PM' },
        asr: { adhan: '4:45 PM', iqama: '5:15 PM' },
        maghrib: { adhan: '7:30 PM', iqama: '7:35 PM' },
        isha: { adhan: '9:00 PM', iqama: '9:15 PM' },
        jumuah: { adhan: '1:00 PM', iqama: '1:30 PM' }
    };
}

function showLoading(show) {
    state.isLoading = show;
    const loader = document.getElementById('loading-indicator');
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
}

function showToast(message, type = 'info') {
    // Simple toast implementation
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #333;
        color: white;
        padding: 12px 24px;
        border-radius: 24px;
        z-index: 2000;
        animation: fadeIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
