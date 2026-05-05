<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuditApiRequests
{
    private const REDACTED_FIELDS = [
        'access_token',
        'address',
        'password',
        'confirmPassword',
        'confirm_password',
        'password_confirmation',
        'token',
        'authorization',
        'expo_push_token',
        'profile_picture',
        'image',
        'phone',
        'payment_phone',
        'contact_info',
        'insurance_code',
        'membership_code',
        'clinical_notes',
        'complaints',
        'complaints_notes',
        'diagnosis',
        'notes',
        'consultation_notes',
        'nursing_notes',
        'prescription_notes',
        'prescription_items',
        'lab_tests',
        'lab_results',
        'vitals',
        'patients_to_watch',
        'incidents',
        'handover_notes',
        'summary',
        'result',
        'metadata',
        'data',
    ];

    private const SENSITIVE_READ_PATHS = [
        'patients',
        'visits',
        'hospitalizations',
        'nursing',
        'labo',
        'pharmacy',
        'invoices',
        'cashier',
        'admin/users',
        'admin/dashboard',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if ($request->user() && $this->shouldAudit($request)) {
            AuditLog::create([
                'user_id' => $request->user()->id,
                'user_role' => $request->user()->role,
                'method' => $request->method(),
                'path' => '/' . ltrim($request->path(), '/'),
                'route_name' => $request->route()?->getName(),
                'status_code' => $response->getStatusCode(),
                'payload' => $this->auditPayload($request),
                'ip_address' => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 255),
            ]);
        }

        return $response;
    }

    private function shouldAudit(Request $request): bool
    {
        if (!$request->isMethod('GET')) {
            return true;
        }

        $path = trim($request->path(), '/');

        foreach (self::SENSITIVE_READ_PATHS as $sensitivePath) {
            if ($path === 'api/' . $sensitivePath || str_starts_with($path, 'api/' . $sensitivePath . '/')) {
                return true;
            }
        }

        return false;
    }

    private function auditPayload(Request $request): array
    {
        if ($request->isMethod('GET')) {
            return [
                'query' => $this->redact($request->query()),
                'read_audit' => true,
            ];
        }

        return $this->redact($request->all());
    }

    private function redact(array $payload): array
    {
        foreach ($payload as $key => $value) {
            if ($this->isRedactedField((string) $key)) {
                $payload[$key] = '[REDACTED]';
                continue;
            }

            if (is_array($value)) {
                $payload[$key] = $this->redact($value);
            }
        }

        return $payload;
    }

    private function isRedactedField(string $key): bool
    {
        $normalized = strtolower($key);

        foreach (self::REDACTED_FIELDS as $field) {
            if ($normalized === strtolower($field)) {
                return true;
            }
        }

        return false;
    }
}
