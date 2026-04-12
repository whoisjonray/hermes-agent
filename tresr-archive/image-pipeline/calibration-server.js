#!/usr/bin/env node

/**
 * Simple HTTP server for template calibration tool
 * Serves the calibration HTML and template images
 */

const express = require('express');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 3456;

// Serve static files from the templates directory
app.use('/templates', express.static(path.join(__dirname, '../../templates')));

// Serve the calibration tool
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'calibrate-template-mappings.html'));
});

// Start server
app.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`\n🎯 Template Calibration Server Running`);
    console.log(`━`.repeat(60));
    console.log(`\n📍 Open in browser: ${url}`);
    console.log(`\n✨ Opening browser...\n`);

    // Auto-open browser using macOS 'open' command
    exec(`open "${url}"`);
});
