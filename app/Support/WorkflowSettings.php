<?php

namespace App\Support;

use App\Models\Setting;

class WorkflowSettings
{
    public static function servicePrices(): array
    {
        return [
            'fiche_price' => (float) Setting::getValue('fiche_price', 5000),
            'soins_price' => (float) Setting::getValue('soins_price', 0),
            'consultation_price' => (float) Setting::getValue('consultation_price', 0),
            'maternity_prenatal_fee' => (float) Setting::getValue('maternity_prenatal_fee', 0),
            'maternity_delivery_fee' => (float) Setting::getValue('maternity_delivery_fee', 0),
        ];
    }

    public static function servicePrice(string $key, float $default = 0): float
    {
        $prices = self::servicePrices();

        return array_key_exists($key, $prices) ? (float) $prices[$key] : $default;
    }

    public static function labTestsCatalog(): array
    {
        $raw = Setting::getValue('lab_tests_catalog');

        if (!$raw) {
            return self::defaultLabTestsCatalog();
        }

        $decoded = json_decode($raw, true);

        if (!is_array($decoded)) {
            return self::defaultLabTestsCatalog();
        }

        return array_values(array_filter(array_map(function ($item) {
            if (!is_array($item) || empty($item['code']) || empty($item['label'])) {
                return null;
            }

            return [
                'code' => (string) $item['code'],
                'label' => (string) $item['label'],
                'price' => (float) ($item['price'] ?? 0),
            ];
        }, $decoded)));
    }

    public static function defaultLabTestsCatalog(): array
    {
        return [
            ['code' => 'NFS', 'label' => 'NFS (Hemogramme)', 'price' => 15000],
            ['code' => 'GLY', 'label' => 'Glycemie', 'price' => 5000],
            ['code' => 'PALU', 'label' => 'TDR Paludisme', 'price' => 7000],
            ['code' => 'GE', 'label' => 'Goutte Epaisse', 'price' => 6000],
            ['code' => 'WIDAL', 'label' => 'Widal & Felix', 'price' => 8000],
            ['code' => 'ECBU', 'label' => 'ECBU', 'price' => 12000],
            ['code' => 'HIV', 'label' => 'Test VIH', 'price' => 5000],
            ['code' => 'HEPB', 'label' => 'Hepatite B (AgHBs)', 'price' => 10000],
            ['code' => 'CHOL', 'label' => 'Cholesterol Total', 'price' => 8000],
            ['code' => 'CREA', 'label' => 'Creatinine', 'price' => 7000],
            ['code' => 'URINE', 'label' => 'Examen des Urines', 'price' => 5000],
            ['code' => 'PREG', 'label' => 'Test Grossesse (HCG)', 'price' => 5000],
            ['code' => 'VS', 'label' => 'Vitesse de Sedimentation', 'price' => 4000],
        ];
    }

    public static function labTestsByCode(): array
    {
        $indexed = [];

        foreach (self::labTestsCatalog() as $test) {
            $indexed[$test['code']] = $test;
        }

        return $indexed;
    }
    public static function otherPricesCatalog(): array
    {
        $raw = Setting::getValue('other_prices_catalog');

        if (!$raw) {
            return [];
        }

        $decoded = json_decode($raw, true);

        if (!is_array($decoded)) {
            return [];
        }

        return array_values(array_filter(array_map(function ($item) {
            if (!is_array($item) || empty($item['label'])) {
                return null;
            }

            return [
                'type' => (string) ($item['type'] ?? 'Autre'),
                'label' => (string) $item['label'],
                'price' => (float) ($item['price'] ?? 0),
                'dosage' => isset($item['dosage']) ? (string) $item['dosage'] : null,
            ];
        }, $decoded)));
    }
}
