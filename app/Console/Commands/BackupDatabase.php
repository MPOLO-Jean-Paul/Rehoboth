<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;

class BackupDatabase extends Command
{
    protected $signature = 'app:backup-database';
    protected $description = 'Sauvegarde complète de la base de données au format JSON';

    public function handle()
    {
        $this->info('Démarrage de la sauvegarde...');

        $tables = DB::select('SHOW TABLES');
        $dbName = config('database.connections.mysql.database');
        $key = "Tables_in_{$dbName}";

        $backup = [
            'metadata' => [
                'timestamp' => now()->toIso8601String(),
                'hospital' => \App\Support\WorkflowSettings::get('hospital_name', 'Polyclique Rehoboth'),
                'version' => '2.0',
            ],
            'data' => []
        ];

        foreach ($tables as $table) {
            $tableName = $table->$key;
            
            // Ignorer les tables de cache ou de sessions si nécessaire, mais ici on prend tout pour la sécurité
            if (in_array($tableName, ['sessions', 'cache', 'cache_locks'])) continue;

            $this->comment("Export de la table : {$tableName}");
            $backup['data'][$tableName] = DB::table($tableName)->get()->toArray();
        }

        $json = json_encode($backup, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        $filename = 'backups/backup-' . now()->format('Y-m-d-His') . '.json';
        
        Storage::disk('local')->put($filename, $json);

        $this->info("Sauvegarde terminée : storage/app/{$filename}");

        // Nettoyage des anciennes sauvegardes (> 7 jours)
        $this->cleanupOldBackups();

        return 0;
    }

    private function cleanupOldBackups()
    {
        $files = Storage::disk('local')->files('backups');
        $now = now();

        foreach ($files as $file) {
            $time = Storage::disk('local')->lastModified($file);
            if ($now->diffInDays(\Carbon\Carbon::createFromTimestamp($time)) > 7) {
                Storage::disk('local')->delete($file);
                $this->warn("Ancienne sauvegarde supprimée : {$file}");
            }
        }
    }
}
