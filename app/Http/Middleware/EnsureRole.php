<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $allowedRoles = collect($roles)
            ->flatMap(fn (string $roleSet) => array_map('trim', explode(',', $roleSet)))
            ->filter()
            ->unique()
            ->values();

        if ($allowedRoles->isNotEmpty() && !$allowedRoles->contains($user->role)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return $next($request);
    }
}
