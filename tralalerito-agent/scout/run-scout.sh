#!/usr/bin/env bash
set -e
cd /root/tralala-bot-sync/tralalerito-agent
/usr/bin/node --env-file=.env scout/worker.mjs >> scout/data/scout.log 2>&1
/usr/bin/node --env-file=.env scout/queue.mjs >> scout/data/scout.log 2>&1
/usr/bin/node --env-file=.env scout/drafts.mjs >> scout/data/scout.log 2>&1
