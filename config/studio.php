<?php

return [
    // Secret required to create the first (admin) account on a fresh production install.
    'setup_token' => env('SETUP_TOKEN'),

    // Shared hosting without a process manager: let the scheduler drain the queue every minute.
    'queue_via_scheduler' => (bool) env('QUEUE_VIA_SCHEDULER', false),

    // Daily backups (spatie/laravel-backup). BACKUP_DISK may point to an S3-compatible disk.
    'backup_disk' => env('BACKUP_DISK', 'backups'),

    // Project templates (Mariage, Séance…). Hidden for now: set FEATURE_TEMPLATES=true to bring them back.
    'templates' => (bool) env('FEATURE_TEMPLATES', false),
];
