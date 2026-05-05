#!/bin/bash

# Optimisations Laravel
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Exécuter les migrations (seulement si la DB est prête)
# Le flag --force est obligatoire en production
php artisan migrate --force

# Démarrer Apache en arrière-plan
apache2-foreground
