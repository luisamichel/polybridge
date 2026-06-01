#!/bin/bash
sed -i 's/POLYBRIDGE_DB=.*/POLYBRIDGE_DB=demo_luisa.db/' .env
echo "✓ Switched to demo DB (demo_luisa.db)"
echo "  Restart uvicorn if running: pkill -f uvicorn && uvicorn api:app --reload --port 8000"
