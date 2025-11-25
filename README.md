# US Mosques & Islamic Centers Finder

A beautiful, Google Maps-inspired web application for finding mosques and Islamic centers across the United States.

## Features

- 🗺️ **Google Maps-style Interface** - Clean, modern design using CartoDB Voyager tiles
- 🕌 **Dual Data Sources** - Combines MasjidiAPI and OpenStreetMap data
- 🔍 **Smart Search** - Search by city, state, or mosque name
- 📍 **Location Services** - "Find Nearby" feature using your current location
- 🎨 **Custom Markers** - Red pin markers mimicking Google Maps style
- 📊 **Marker Clustering** - Efficient display of many locations with color-coded clusters
- 💯 **100% Free** - No API keys or billing required

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Maps**: Leaflet.js with CartoDB Voyager tiles
- **Backend Proxy**: Node.js + Express (to bypass CORS)
- **Data Sources**:
  - MasjidiAPI (via proxy)
  - OpenStreetMap Overpass API

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Proxy Server

The proxy server is required to access MasjidiAPI without CORS issues:

```bash
node server.js
```

The proxy will run on `http://localhost:3001`

### 3. Start the Frontend

In a separate terminal, serve the frontend:

```bash
npx serve .
```

The app will be available at `http://localhost:3000`

## Current Status

⚠️ **Note**: The MasjidiAPI (`https://api.masjidiapp.com`) is currently experiencing SSL/TLS connection issues. The application gracefully falls back to OpenStreetMap data when MasjidiAPI is unavailable.

### Data Sources Status:
- ✅ **OpenStreetMap** - Working (community-sourced data)
- ⚠️ **MasjidiAPI** - Temporarily unavailable (SSL errors)

## How It Works

1. **Frontend** (`app.js`) makes requests to the proxy server at `localhost:3001`
2. **Proxy Server** (`server.js`) forwards requests to MasjidiAPI with proper headers
3. **Fallback**: If MasjidiAPI fails, the app uses OpenStreetMap data
4. **Deduplication**: Results from both sources are combined and deduplicated

## File Structure

```
├── index.html          # Main HTML file
├── app.js              # Frontend JavaScript
├── styles.css          # Styling (Google Maps-inspired)
├── server.js           # Proxy server
├── package.json        # Dependencies
└── README.md           # This file
```

## API Endpoints

### Proxy Server

- `GET /api/masjids?lat={lat}&long={lng}&dist={dist}&limit={limit}`
  - Proxies requests to MasjidiAPI
  - Parameters:
    - `lat`: Latitude
    - `long`: Longitude
    - `dist`: Search radius in km (default: 50)
    - `limit`: Max results (default: 100)

- `GET /health`
  - Health check endpoint

## Troubleshooting

### MasjidiAPI Not Working

If you see "Proxy returned status: 500" in the console:
1. Check if `https://api.masjidiapp.com` is accessible
2. The app will automatically fall back to OpenStreetMap data
3. You'll still see mosques, but coverage may be limited

### No Mosques Showing

1. **Zoom in more** - The app only fetches data at zoom level 9 or higher
2. **Check your location** - Some areas have better OSM coverage than others
3. **Contribute to OSM** - Add missing mosques at [openstreetmap.org](https://www.openstreetmap.org)

## Contributing to Data

### Add Missing Mosques to OpenStreetMap:

1. Create an account at [openstreetmap.org](https://www.openstreetmap.org)
2. Click "Edit" and find the mosque location
3. Add a point with these tags:
   - `amenity=place_of_worship`
   - `religion=muslim`
   - `name=Mosque Name`
4. Changes appear in the app within 24-48 hours

## Future Enhancements

- [ ] Real prayer times integration
- [ ] Iqama times from MasjidiAPI
- [ ] Directions integration
- [ ] Mobile app version
- [ ] User reviews and ratings
- [ ] Event listings

## License

MIT

## Credits

- Map tiles by [CartoDB](https://carto.com/)
- Map data © [OpenStreetMap](https://www.openstreetmap.org/) contributors
- Mosque data from [MasjidiAPI](https://github.com/MasjidiApp/MasjidiAPI)
