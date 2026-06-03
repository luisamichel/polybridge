#!/bin/bash
sed -i 's/POLYBRIDGE_DB=.*/POLYBRIDGE_DB=demo_spanish.db/' .env
echo "✓ Switched to Spanish demo DB (demo_spanish.db)"
echo "  Restart uvicorn if running: pkill -f uvicorn && uvicorn api:app --reload --port 8000"
