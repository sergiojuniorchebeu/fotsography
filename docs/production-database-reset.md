# Réinitialiser la base de production

La protection Laravel contre les commandes destructrices reste active en production. Les commandes `migrate:fresh`, `migrate:refresh`, `migrate:reset`, `migrate:rollback` et `db:wipe` restent bloquées par défaut.

## Mise à jour normale

Pour appliquer les migrations sans effacer les données existantes, utilisez la commande habituelle depuis le terminal cPanel :

```bash
php artisan migrate --force
```

## Réinitialisation complète et volontaire

La réinitialisation supprime définitivement toutes les tables et données de la base ciblée, puis recrée le schéma en rejouant les migrations. Elle efface notamment les comptes administrateurs, projets, tâches, finances et données d’application. Faites une sauvegarde exportée hors de cette base et vérifiez les paramètres `DB_*` du `.env` avant de continuer.

Depuis le terminal cPanel, lancez :

```bash
php artisan studio:reset-production-database
```

La commande exige un terminal interactif, l’adresse et le mot de passe masqué d’un compte Administrateur actif, puis la saisie exacte de `RESET FOTSOGRAPHY DATABASE`. Une authentification ou confirmation incorrecte arrête l’opération sans appeler `migrate:fresh`.

Après la réinitialisation, les données métier sont vides et les comptes ont été supprimés. Créez un nouvel administrateur avec :

```bash
php artisan studio:create-admin
```

La commande dédiée assouplit temporairement les protections de `migrate:fresh` et `db:wipe` — cette dernière est appelée en interne par Laravel pendant `migrate:fresh`. Elle rétablit ces deux protections à la fin ; `migrate:refresh`, `migrate:reset` et `migrate:rollback` restent bloquées.
