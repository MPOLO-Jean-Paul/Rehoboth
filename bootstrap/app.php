<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use App\Http\Middleware\AuditApiRequests;
use App\Http\Middleware\EnsureIdempotentMutations;
use App\Http\Middleware\EnsureRole;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(append: [
            EnsureIdempotentMutations::class,
            AuditApiRequests::class,
        ]);

        $middleware->alias([
            'role' => EnsureRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\Illuminate\Database\QueryException $e) {
            \Log::error('Database query error', ['exception' => $e]);

            return response()->json([
                'message' => 'Une erreur interne est survenue. Veuillez réessayer plus tard.'
            ], 500);
        });
        $exceptions->render(function (\PDOException $e) {
            \Log::error('PDO connection error', ['exception' => $e]);

            return response()->json([
                'message' => 'Une erreur interne est survenue. Veuillez réessayer plus tard.'
            ], 500);
        });
    })->create();
