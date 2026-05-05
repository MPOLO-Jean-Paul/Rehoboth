<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class ProductionReadinessCheck extends Command
{
    protected $signature = 'app:production-readiness';

    protected $description = 'Check critical settings before hosting the hospital application in production.';

    public function handle(): int
    {
        $failures = [];
        $warnings = [];

        $this->requireValue('APP_KEY', $failures, 'APP_KEY doit etre defini.');
        $this->requireValue('DB_PASSWORD', $failures, 'DB_PASSWORD doit etre defini et fort.');

        if (app()->environment('production')) {
            if (config('app.debug')) {
                $failures[] = 'APP_DEBUG doit etre false en production.';
            }

            $this->assertHttps((string) config('app.url'), $failures, 'APP_URL doit utiliser HTTPS en production.');
            $this->assertNotEquals('root', (string) config('database.connections.' . config('database.default') . '.username'), $failures, 'La base de donnees ne doit pas utiliser root.');
            $this->assertNotEquals('sync', (string) config('queue.default'), $failures, 'QUEUE_CONNECTION ne doit pas etre sync en production.');
            $this->assertNotEquals('file', (string) config('cache.default'), $warnings, 'CACHE_STORE devrait etre database ou redis en production.');
            $this->assertNotEquals('debug', (string) env('LOG_LEVEL', 'debug'), $warnings, 'LOG_LEVEL devrait etre info, warning ou error en production.');
        }

        if ((int) config('sanctum.expiration') <= 0) {
            $failures[] = 'SANCTUM_EXPIRATION doit expirer les tokens.';
        }

        if ((int) env('BCRYPT_ROUNDS', 12) < 12) {
            $warnings[] = 'BCRYPT_ROUNDS devrait etre au moins 12.';
        }

        if (empty(config('cors.allowed_origins'))) {
            $failures[] = 'CORS_ALLOWED_ORIGINS doit lister explicitement les applications autorisees.';
        }

        foreach ($warnings as $warning) {
            $this->warn('[WARN] ' . $warning);
        }

        foreach ($failures as $failure) {
            $this->error('[FAIL] ' . $failure);
        }

        if ($failures) {
            $this->newLine();
            $this->error('Application non prete pour hebergement production.');

            return self::FAILURE;
        }

        $this->info('Controle applicatif OK. Completer avec audit hebergeur, sauvegardes, supervision et tests de charge.');

        return self::SUCCESS;
    }

    private function requireValue(string $key, array &$failures, string $message): void
    {
        $value = env($key);

        if ($value === null || $value === '') {
            $failures[] = $message;
        }
    }

    private function assertEquals(string $expected, string $actual, array &$failures, string $message): void
    {
        if (strtolower($actual) !== strtolower($expected)) {
            $failures[] = $message;
        }
    }

    private function assertNotEquals(string $forbidden, string $actual, array &$issues, string $message): void
    {
        if (strtolower($actual) === strtolower($forbidden)) {
            $issues[] = $message;
        }
    }

    private function assertHttps(string $url, array &$failures, string $message): void
    {
        if (!str_starts_with(strtolower($url), 'https://')) {
            $failures[] = $message;
        }
    }
}
