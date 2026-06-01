#!/bin/bash
sed -i 's/POLYBRIDGE_DB=.*/POLYBRIDGE_DB=polyglot.db/' .env
echo "✓ Switched to live DB (polyglot.db)"
echo "  Restart uvicorn if running: pkill -f uvicorn && uvicorn api:app --reload --port 8000"
