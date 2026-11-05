#!/usr/bin/env bash
# Mise à jour de Fotsography Studio sur le serveur.
# Usage : cd /var/www/fotsography && bash deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ Mode maintenance"
php artisan down --retry=30 || true
trap 'php artisan up' EXIT

echo "→ Récupération du code"
git pull --ff-only

echo "→ Dépendances PHP"
composer install --no-dev --optimize-autoloader --no-interaction

echo "→ Compilation de l'interface"
if command -v npm >/dev/null 2>&1; then
    npm ci --no-audit --no-fund
    npm run build
else
    echo "  npm absent : assurez-vous que public/build a été compilé et envoyé."
fi

echo "→ Sauvegarde avant migration"
php artisan backup:run --only-db || echo "  (sauvegarde impossible, on continue)"

echo "→ Base de données"
php artisan migrate --force

echo "→ Caches"
php artisan storage:link 2>/dev/null || true
php artisan optimize:clear
php artisan optimize

echo "→ Redémarrage de la file d'attente"
php artisan queue:restart

echo "→ Vérification"
php artisan studio:check || true

echo "✓ Déploiement terminé"
