<?php

namespace App\Http\Controllers;

use App\Models\Hospitalization;
use App\Models\Invoice;
use App\Models\Patient;
use App\Traits\NotifiesUsers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HospitalizationController extends Controller
{
    use NotifiesUsers;

    /**
     * Liste tous les hospitalisés actifs
     */
    public function index(Request $request): JsonResponse
    {
        $query = Hospitalization::with(['patient', 'doctor'])
            ->orderBy('admission_date', 'desc');

        if ($request->has('status')) {
            $query->where('status', $request->status);
        } else {
            $query->where('status', 'active');
        }

        if ($request->has('ward')) {
            $query->where('ward', $request->ward);
        }

        $hospitalizations = $query->get()->map(function ($h) {
            return array_merge($h->toArray(), [
                'days_count'   => $h->days_count,
                'total_amount' => $h->total_amount,
            ]);
        });

        return response()->json($hospitalizations);
    }

    /**
     * Admettre un patient en hospitalisation
     */
    public function admit(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'patient_id'          => 'required|exists:patients,id',
            'visit_id'            => 'nullable|exists:visits,id',
            'room_number'         => 'nullable|string|max:20',
            'bed_number'          => 'nullable|string|max:20',
            'ward'                => 'nullable|string|max:100',
            'daily_rate'          => 'required|numeric|min:0',
            'diagnosis'           => 'nullable|string',
            'notes'               => 'nullable|string',
            'attending_doctor_id' => 'nullable|exists:users,id',
            'admission_date'      => 'nullable|date',
        ]);

        // Vérifier si patient déjà hospitalisé
        $existing = Hospitalization::where('patient_id', $validated['patient_id'])
            ->where('status', 'active')
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'Ce patient est déjà hospitalisé (Chambre ' . $existing->room_number . ').'
            ], 409);
        }

        $hospitalization = Hospitalization::create([
            ...$validated,
            'admission_date' => $validated['admission_date'] ?? now()->toDateString(),
            'status' => 'active',
        ]);

        // Notifier la caisse
        $patient = Patient::find($validated['patient_id']);
        $this->notifyRole('caisse', '🏥 Nouvelle Hospitalisation',
            "Le patient {$patient->first_name} {$patient->last_name} a été admis en hospitalisation. Tarif: " . number_format($validated['daily_rate'], 0) . " FC/jour.",
            ['hospitalization_id' => $hospitalization->id]
        );

        return response()->json([
            'message'         => 'Patient admis en hospitalisation.',
            'hospitalization' => $hospitalization->load(['patient', 'doctor']),
        ], 201);
    }

    /**
     * Mettre à jour le dossier d'hospitalisation
     */
    public function update(Request $request, $id): JsonResponse
    {
        $hospitalization = Hospitalization::findOrFail($id);

        $validated = $request->validate([
            'room_number'         => 'nullable|string|max:20',
            'bed_number'          => 'nullable|string|max:20',
            'ward'                => 'nullable|string|max:100',
            'daily_rate'          => 'nullable|numeric|min:0',
            'diagnosis'           => 'nullable|string',
            'notes'               => 'nullable|string',
            'attending_doctor_id' => 'nullable|exists:users,id',
        ]);

        $hospitalization->update($validated);

        return response()->json([
            'message'         => 'Dossier mis à jour.',
            'hospitalization' => $hospitalization->fresh(['patient', 'doctor']),
        ]);
    }

    /**
     * Sortie d'un patient hospitalisé (décharge)
     */
    public function discharge(Request $request, $id): JsonResponse
    {
        $hospitalization = Hospitalization::with('patient')->findOrFail($id);

        if ($hospitalization->status !== 'active') {
            return response()->json(['message' => 'Ce patient est déjà sorti.'], 409);
        }

        return DB::transaction(function () use ($hospitalization) {
            $hospitalization->update([
                'status'         => 'discharged',
                'discharge_date' => now()->toDateString(),
            ]);

            // Facturation finale des jours restants non facturés
            $lastBilled  = $hospitalization->last_billed_at?->toDateString() ?? $hospitalization->admission_date->toDateString();
            $today       = now()->toDateString();
            $daysPending = $hospitalization->admission_date->diffInDays($today) - 
                           $hospitalization->admission_date->diffInDays($lastBilled);

            if ($daysPending > 0) {
                $amount = $daysPending * (float) $hospitalization->daily_rate;
                $invoice = Invoice::create([
                    'patient_id' => $hospitalization->patient_id,
                    'visit_id'   => $hospitalization->visit_id,
                    'insurance_id' => $hospitalization->patient->is_insured ? $hospitalization->patient->insurance_id : null,
                    'amount'     => $amount,
                    'status'     => $hospitalization->patient->is_insured ? 'insurance_billed' : 'unpaid',
                    'details'    => "Frais d'hospitalisation finale ({$daysPending} jours restants) - Chambre {$hospitalization->room_number}",
                    'service'    => 'hospitalisation',
                    'item_count' => $daysPending,
                    'metadata'   => [
                        'type'        => 'discharge_billing',
                        'days'        => $daysPending,
                        'daily_rate'  => $hospitalization->daily_rate,
                        'ward'        => $hospitalization->ward,
                    ],
                ]);

                $this->notifyRole('caisse', '🏥 Sortie Patient - Facture Finale',
                    "Le patient {$hospitalization->patient->first_name} {$hospitalization->patient->last_name} est sorti. Facture finale: " . number_format($amount, 0) . " FC.",
                    ['invoice_id' => $invoice->id]
                );
            }

            return response()->json([
                'message'         => 'Patient sorti avec succès. Facture finale générée à la caisse.',
                'hospitalization' => $hospitalization->fresh(['patient', 'doctor']),
            ]);
        });
    }

    /**
     * Facturation journalière de tous les hospitalisés actifs
     * (à appeler par un scheduler ou manuellement depuis le frontend)
     */
    public function billDaily(): JsonResponse
    {
        $today    = now()->toDateString();
        $billed   = 0;
        $total    = 0;

        $active = Hospitalization::with('patient')
            ->where('status', 'active')
            ->get();

        foreach ($active as $h) {
            // Éviter de facturer deux fois le même jour
            if ($h->last_billed_at && $h->last_billed_at->toDateString() === $today) {
                continue;
            }

            $amount = (float) $h->daily_rate;

            Invoice::create([
                'patient_id' => $h->patient_id,
                'visit_id'   => $h->visit_id,
                'insurance_id' => $h->patient->is_insured ? $h->patient->insurance_id : null,
                'amount'     => $amount,
                'status'     => $h->patient->is_insured ? 'insurance_billed' : 'unpaid',
                'details'    => "Frais d'hospitalisation journaliers du {$today} - Chambre {$h->room_number} ({$h->ward})",
                'service'    => 'hospitalisation',
                'item_count' => 1,
                'metadata'   => [
                    'type'       => 'daily_billing',
                    'date'       => $today,
                    'daily_rate' => $h->daily_rate,
                    'ward'       => $h->ward,
                    'room'       => $h->room_number,
                ],
            ]);

            $h->update(['last_billed_at' => now()]);
            $billed++;
            $total += $amount;
        }

        $this->notifyRole('caisse', '💰 Facturation Journalière',
            "{$billed} patient(s) hospitalisé(s) facturé(s) pour un total de " . number_format($total, 0) . " FC.",
            ['date' => $today]
        );

        return response()->json([
            'message'       => "Facturation journalière terminée.",
            'billed_count'  => $billed,
            'total_amount'  => $total,
            'date'          => $today,
        ]);
    }

    /**
     * Statistiques de l'hospitalisation
     */
    public function stats(): JsonResponse
    {
        $active       = Hospitalization::where('status', 'active')->count();
        $discharged   = Hospitalization::whereDate('discharge_date', now()->toDateString())->count();
        $totalRevenue = Hospitalization::where('status', 'active')
            ->get()
            ->sum(fn ($h) => $h->total_amount);

        $byWard = Hospitalization::where('status', 'active')
            ->selectRaw('ward, count(*) as count')
            ->groupBy('ward')
            ->get();

        return response()->json([
            'active_count'     => $active,
            'discharged_today' => $discharged,
            'total_revenue'    => $totalRevenue,
            'by_ward'          => $byWard,
        ]);
    }
}
