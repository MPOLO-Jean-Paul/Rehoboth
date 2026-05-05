# Preparation production hospitaliere

Cette application traite des donnees administratives, medicales et financieres. Avant tout usage avec de vrais patients, elle doit etre hebergee, exploitee et auditee comme un systeme sensible.

## Controle applicatif

Executer avant chaque mise en production:

```bash
php artisan app:production-readiness
php artisan test
composer audit
npm audit --audit-level=moderate
```

Le controle applicatif ne remplace pas l'audit de securite, l'audit legal, ni la validation de l'hebergeur.

## Variables obligatoires en production

- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://...`
- `DB_USERNAME` doit etre un compte applicatif dedie, jamais `root`
- `DB_PASSWORD` doit etre long, unique et secret
- `QUEUE_CONNECTION=database` ou `redis`, jamais `sync`
- `CACHE_STORE=database` ou `redis`
- `SESSION_DRIVER=database` ou `redis`
- `SESSION_ENCRYPT=true`
- `LOG_LEVEL=info`, `warning` ou `error`
- `CORS_ALLOWED_ORIGINS` doit lister seulement les origines autorisees
- `SANCTUM_EXPIRATION` doit rester defini pour expirer les tokens

## Exigences hors code

- HTTPS obligatoire partout, avec certificats valides.
- Hebergement conforme au cadre applicable aux donnees de sante.
- Sauvegardes chiffrees, automatisees et testees par restauration.
- Plan de reprise et plan de continuite documentes.
- Supervision serveur, base de donnees, files d'attente, stockage, erreurs applicatives et espace disque.
- Revue periodique des utilisateurs, roles et habilitations.
- Journalisation conservee, protegee et revue regulierement.
- Procedure de gestion des incidents et des violations de donnees.
- Tests de charge avant ouverture a grande echelle.

## Points a valider avec l'hopital

- Matrice d'habilitation exacte par service, role, equipe de soins et urgence.
- Politique de conservation et d'archivage des dossiers.
- Procedure de correction d'erreur medicale et de non-repudiation.
- Besoin de mode urgence avec justification et surveillance renforcee.
- Integration eventuelle avec annuaire, SSO, badge, MFA ou MDM.
