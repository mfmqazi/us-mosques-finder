const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Proxy endpoint for MasjidiAPI
app.get('/api/masjids', async (req, res) => {
    try {
        const { lat, long, dist, limit } = req.query;

        // Validate required parameters
        if (!lat || !long) {
            return res.status(400).json({ error: 'lat and long parameters are required' });
        }

        // Build the MasjidiAPI v2 URL
        const apiUrl = `https://api.masjidiapp.com/v2/masjids?lat=${lat}&long=${long}&dist=${dist || 50}&limit=${limit || 100}`;

        console.log('Proxying request to:', apiUrl);

        // Make the request to MasjidiAPI v2
        const response = await fetch(apiUrl, {
            headers: {
                'x-api-key': '123-test-key'
            }
        });

        if (!response.ok) {
            console.error('MasjidiAPI error:', response.status, response.statusText);
            return res.status(response.status).json({
                error: 'MasjidiAPI request failed',
                status: response.status
            });
        }

        const data = await response.json();
        console.log(`Successfully fetched ${Array.isArray(data) ? data.length : 'unknown'} masjids`);

        // Return the data
        res.json(data);

    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Proxy server is running' });
});

app.listen(PORT, () => {
    console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
    console.log(`📍 Masjid API v2 endpoint: http://localhost:${PORT}/api/masjids`);
    console.log(`💚 Health check: http://localhost:${PORT}/health`);
});
