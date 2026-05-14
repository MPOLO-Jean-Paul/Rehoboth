<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class MobileMoneyPaymentService
{
    private const PROVIDERS = ['orange', 'airtel', 'mpesa'];

    public function charge(string $provider, string $phone, float $amount, string $currency, ?string $description = null): array
    {
        $provider = strtolower($provider);
        $currency = strtoupper($currency ?: 'CDF');

        if (!in_array($provider, self::PROVIDERS, true)) {
            throw new RuntimeException('Opérateur mobile money non supporté.');
        }

        $config = config("services.mobile_money.providers.{$provider}", []);
        $endpoint = $config['endpoint'] ?? null;
        $clientId = $config['client_id'] ?? null;
        $clientSecret = $config['client_secret'] ?? null;
        $merchantId = $config['merchant_id'] ?? null;

        if (!$endpoint || !$clientId || !$clientSecret || !$merchantId) {
            throw new RuntimeException("Mobile money {$provider} non configuré. Ajoutez endpoint, client_id, client_secret et merchant_id dans .env.");
        }

        $reference = strtoupper($provider) . '-' . now()->format('YmdHis') . '-' . Str::upper(Str::random(6));
        $account = $currency === 'USD'
            ? ($config['usd_account'] ?? $merchantId)
            : ($config['cdf_account'] ?? $merchantId);

        $payload = [
            'merchant_id' => $merchantId,
            'account' => $account,
            'account_currency' => $currency,
            'reference' => $reference,
            'phone' => $this->normalizePhone($phone),
            'amount' => round($amount, 2),
            'currency' => $currency,
            'description' => $description ?: 'Paiement facture Rehoboth',
            'callback_url' => config('services.mobile_money.callback_url'),
        ];

        $response = Http::timeout((int) config('services.mobile_money.timeout', 30))
            ->acceptJson()
            ->withHeaders([
                'X-Client-Id' => $clientId,
                'X-Client-Secret' => $clientSecret,
                'X-Merchant-Id' => $merchantId,
                'Idempotency-Key' => $reference,
            ])
            ->post($endpoint, $payload);

        if (!$response->successful()) {
            return [
                'status' => 'failed',
                'reference' => $reference,
                'provider_response' => $response->json() ?: ['body' => $response->body()],
                'message' => 'Le fournisseur mobile money a refusé la transaction.',
            ];
        }

        $body = $response->json() ?: [];
        $status = $this->normalizeStatus($body['status'] ?? $body['payment_status'] ?? $body['state'] ?? null);

        return [
            'status' => $status,
            'reference' => $body['reference'] ?? $body['transaction_id'] ?? $reference,
            'provider_response' => $body,
            'message' => $body['message'] ?? match ($status) {
                'succeeded' => 'Paiement mobile money confirmé.',
                'pending' => 'Paiement mobile money en attente de confirmation.',
                default => 'Paiement mobile money échoué.',
            },
        ];
    }

    private function normalizeStatus(?string $status): string
    {
        $status = strtolower((string) $status);

        return match (true) {
            in_array($status, ['success', 'succeeded', 'paid', 'completed', 'confirmed', 'approved'], true) => 'succeeded',
            in_array($status, ['pending', 'processing', 'initiated', 'waiting', 'queued'], true) => 'pending',
            default => 'failed',
        };
    }

    private function normalizePhone(string $phone): string
    {
        $clean = preg_replace('/[\s\-]/', '', $phone);
        if (str_starts_with($clean, '+')) return $clean;
        if (str_starts_with($clean, '243')) return '+' . $clean;
        if (str_starts_with($clean, '0')) return '+243' . substr($clean, 1);

        return '+243' . $clean;
    }
}
