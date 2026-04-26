---
title: Vyla Media Interface
emoji: 🎥
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
short_description: Educational Node.js and WASM implementation.
---

# Vyla Media Interface

An educational video streaming player that demonstrates WebAssembly and Node.js integration.

## Overview

This project explores WebAssembly (WASM) and Node.js integration for handling secure metadata requests and API handshakes in a containerized environment.

## Features

- HTML5 video player with HLS streaming support
- Multi-source streaming with fallback
- WASM-based cryptographic operations
- Mobile-optimized controls
- Customizable subtitles
- Playback speed and quality controls

## Tech Stack

- **Backend**: Node.js, Express.js, libsodium-wrappers
- **Frontend**: Vanilla JavaScript, HLS.js
- **WASM**: Go-compiled cryptographic module
- **Styling**: CSS3 with glassmorphism effects
- **APIs**: TMDB for metadata, Vidlink/VidZee for streaming

## Architecture

```
server.js - Main Express server
api/ - Core API logic and WASM integration
javascript/ - Frontend player logic  
styling/ - UI styles
index.html - Main interface
```

## API Endpoints

- `GET /api?id={movieId}` - Stream movie
- `GET /api?id={seriesId}&s={season}&e={episode}` - Stream TV episode
- `GET /api?tmdb_movie={id}` - Movie metadata
- `GET /api?url={encodedUrl}` - Proxy streaming content

## Deployment

```bash
docker build -t vyla-player .
docker run -p 7860:7860 vyla-player
```

Environment variables:
- `TMDB_API_KEY` - Required for metadata
- `PORT` - Server port (default: 7860)

## Development

```bash
npm install
npm start
```

## License

Educational and research purposes only. Users must comply with third-party API terms of service.