const express = require('express');
const NodeCache = require('node-cache');
const fs = require('fs');
const compression = require('compression');
const bodyParser = require('body-parser');

const app = express();

// Middleware for body parsing and compression
app.use(bodyParser.json());
app.use(compression());

// Create an instance of NodeCache with custom configuration
const cache = new NodeCache({ stdTTL: 100, checkperiod: 120 });

// Middleware to check cache
const checkCache = (req, res, next) => {
    const key = generateCacheKey(req); // Custom cache key generator
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
        console.log('Serving from cache');
        return res.json(JSON.parse(cachedResponse)); // Serve cached response
    }

    next(); // Continue to next middleware if no cache hit
};

// Function to generate a unique cache key
const generateCacheKey = (req) => {
    const { originalUrl, query } = req;
    const queryStr = Object.keys(query).sort().map(key => `${key}=${query[key]}`).join('&');
    return `${originalUrl}?${queryStr}`; // Cache key includes query params
};

// READ Operation - Get data with caching
app.get('/api/data', checkCache, (req, res) => {
    const key = generateCacheKey(req);

    fs.readFile('./large-file.json', 'utf-8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.status(500).send('Internal server error');
        }

        const parsedData = JSON.parse(data);
        cache.set(key, data, 600); // Cache data for 10 minutes

        res.json(parsedData); // Respond with the parsed data
    });
});

// CREATE Operation - Add new data and cache it
app.post('/api/data', (req, res) => {
    const newData = req.body;

    fs.readFile('./large-file.json', 'utf-8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.status(500).send('Internal server error');
        }

        const parsedData = JSON.parse(data);
        parsedData.push(newData); // Add new data to the existing list

        fs.writeFile('./large-file.json', JSON.stringify(parsedData, null, 2), (err) => {
            if (err) {
                console.error('Error writing file:', err);
                return res.status(500).send('Internal server error');
            }

            const key = generateCacheKey(req);
            cache.set(key, JSON.stringify(parsedData), 600); // Cache new data

            res.json({ message: 'Data added and cache updated', newData });
        });
    });
});

// UPDATE Operation - Modify data and update cache
app.put('/api/data/:id', (req, res) => {
    const { id } = req.params;
    const updatedData = req.body;

    fs.readFile('./large-file.json', 'utf-8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.status(500).send('Internal server error');
        }

        let parsedData = JSON.parse(data);
        const index = parsedData.findIndex(item => item.id === parseInt(id));

        if (index === -1) {
            return res.status(404).json({ message: 'Data not found' });
        }

        parsedData[index] = { ...parsedData[index], ...updatedData }; // Update the record

        fs.writeFile('./large-file.json', JSON.stringify(parsedData, null, 2), (err) => {
            if (err) {
                console.error('Error writing file:', err);
                return res.status(500).send('Internal server error');
            }

            const key = generateCacheKey(req);
            cache.set(key, JSON.stringify(parsedData), 600); // Update cache

            res.json({ message: 'Data updated and cache refreshed', updatedData });
        });
    });
});

// DELETE Operation - Remove data and update cache
app.delete('/api/data/:id', (req, res) => {
    const { id } = req.params;

    fs.readFile('./large-file.json', 'utf-8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.status(500).send('Internal server error');
        }

        let parsedData = JSON.parse(data);
        const index = parsedData.findIndex(item => item.id === parseInt(id));

        if (index === -1) {
            return res.status(404).json({ message: 'Data not found' });
        }

        parsedData.splice(index, 1); // Remove the item from the array

        fs.writeFile('./large-file.json', JSON.stringify(parsedData, null, 2), (err) => {
            if (err) {
                console.error('Error writing file:', err);
                return res.status(500).send('Internal server error');
            }

            const key = generateCacheKey(req);
            cache.set(key, JSON.stringify(parsedData), 600); // Update cache

            res.json({ message: 'Data deleted and cache updated' });
        });
    });
});

// Route to manually update cache
app.post('/api/update-data', (req, res) => {
    fs.readFile('./large-file.json', 'utf-8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.status(500).send('Internal server error');
        }

        const updatedData = JSON.parse(data);
        const key = generateCacheKey(req);

        cache.set(key, JSON.stringify(updatedData), 600); // Cache new data

        res.json({ message: 'Cache updated with new data', updatedData });
    });
});

// Cache invalidation route
app.post('/api/invalidate-cache', (req, res) => {
    cache.flushAll(); // Invalidate all cache
    res.send('Cache invalidated');
});

// Start the server
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
