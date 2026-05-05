<?php

namespace App\Http\Middleware;

use App\Models\IdempotencyRecord;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureIdempotentMutations
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $key = $request->header('Idempotency-Key');

        if (!$user || !$key || $request->isMethod('GET')) {
            return $next($request);
        }

        $existing = IdempotencyRecord::where('user_id', $user->id)
            ->where('key', $key)
            ->first();

        if ($existing) {
            if ($existing->method !== $request->method() || $existing->path !== $this->normalizedPath($request)) {
                return response()->json([
                    'message' => 'Cette cle d idempotence a deja ete utilisee pour une autre action.',
                ], 409);
            }

            return response()->json($existing->response_body ?? [], $existing->status_code);
        }

        $response = $next($request);

        if ($response instanceof JsonResponse && $response->getStatusCode() < 500) {
            try {
                IdempotencyRecord::create([
                    'user_id' => $user->id,
                    'key' => $key,
                    'method' => $request->method(),
                    'path' => $this->normalizedPath($request),
                    'status_code' => $response->getStatusCode(),
                    'response_body' => json_decode($response->getContent(), true),
                ]);
            } catch (QueryException) {
                $existing = IdempotencyRecord::where('user_id', $user->id)
                    ->where('key', $key)
                    ->first();

                if ($existing) {
                    return response()->json($existing->response_body ?? [], $existing->status_code);
                }
            }
        }

        return $response;
    }

    private function normalizedPath(Request $request): string
    {
        return '/' . ltrim($request->path(), '/');
    }
}
