<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\MaternityCase;
use App\Models\MaternityFollowUp;
use App\Models\Patient;
use App\Models\Visit;
use App\Support\WorkflowSettings;
use App\Traits\NotifiesUsers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MaternityController extends Controller
{
    use NotifiesUsers;

    public function index(Request $request): JsonResponse
    {
        $perPage = min(max($request->integer('per_page', 30), 10), 100);

        $query = MaternityCase::with([
                'patient:id,first_name,last_name,post_name,is_insured,insurance_id,birth_year,contact_info',
                'midwife:id,name,role,specialty',
                'doctor:id,name,role,specialty',
            ])
            ->withCount('followUps')
            ->latest();

        $query->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')));
        $query->when(!$request->filled('status'), fn ($q) => $q->whereIn('status', ['active', 'labor', 'delivered']));
        $query->when($request->filled('pregnancy_status'), fn ($q) => $q->where('pregnancy_status', $request->string('pregnancy_status')));
        $query->when($request->filled('risk_level'), fn ($q) => $q->where('risk_level', $request->string('risk_level')));

        if ($request->filled('q')) {
            $search = trim($request->string('q')->toString());
            $query->whereHas('patient', function ($q) use ($search) {
                $q->where('first_name', 'like', $search . '%')
                    ->orWhere('last_name', 'like', $search . '%')
                    ->orWhere('post_name', 'like', $search . '%')
                    ->orWhere('contact_info', 'like', '%' . $search . '%');
            });
        }

        return response()->json($query->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validateCase($request);
        $user = $request->user();

        return DB::transaction(function () use ($validated, $request, $user) {
            $existing = MaternityCase::where('patient_id', $validated['patient_id'])
                ->whereIn('status', ['active', 'labor', 'delivered'])
                ->first();

            if ($existing) {
                return response()->json([
                    'message' => 'Ce patient a déjà un dossier maternité actif.',
                    'maternity_case' => $existing,
                ], 409);
            }

            $case = MaternityCase::create([
                ...$validated,
                'status' => $validated['status'] ?? 'active',
                'pregnancy_status' => $validated['pregnancy_status'] ?? 'prenatal',
                'admission_date' => $validated['admission_date'] ?? now(),
                'midwife_id' => $validated['midwife_id'] ?? (in_array($user->role, ['maternite', 'soins'], true) ? $user->id : null),
                'doctor_id' => $validated['doctor_id'] ?? ($user->role === 'medecin' ? $user->id : null),
                'last_checked_at' => now(),
            ]);

            if (!empty($validated['visit_id'])) {
                Visit::whereKey($validated['visit_id'])->update([
                    'current_service' => 'maternite',
                    'status' => 'pending',
                ]);
            }

            $this->createInitialInvoiceIfRequested($case, $request);

            $this->notifyRole('maternite', 'Nouveau dossier maternité',
                "Un dossier maternité a été ouvert pour {$case->patient->first_name} {$case->patient->last_name}.",
                ['type' => 'maternity', 'maternity_case_id' => $case->id, 'visit_id' => $case->visit_id]
            );

            return response()->json([
                'message' => 'Dossier maternité ouvert avec succès.',
                'maternity_case' => $case->fresh(['patient', 'midwife', 'doctor', 'followUps']),
            ], 201);
        });
    }

    public function show($id): JsonResponse
    {
        $case = MaternityCase::with([
            'patient.insurance',
            'visit',
            'midwife:id,name,role,specialty',
            'doctor:id,name,role,specialty',
            'followUps.user:id,name,role',
        ])->findOrFail($id);

        return response()->json($case);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $case = MaternityCase::findOrFail($id);
        $validated = $this->validateCase($request, false);

        $case->update($validated);

        return response()->json([
            'message' => 'Dossier maternité mis à jour.',
            'maternity_case' => $case->fresh(['patient', 'midwife', 'doctor']),
        ]);
    }

    public function addFollowUp(Request $request, $id): JsonResponse
    {
        $case = MaternityCase::with('patient')->findOrFail($id);

        $validated = $request->validate([
            'type' => 'required|string|in:prenatal_check,labor_monitoring,delivery,postnatal,neonatal,emergency',
            'maternal_bp' => 'nullable|string|max:30',
            'fetal_heart_rate' => 'nullable|integer|min:0|max:260',
            'cervical_dilation' => 'nullable|numeric|min:0|max:10',
            'contractions' => 'nullable|string|max:100',
            'baby_weight' => 'nullable|numeric|min:0',
            'temperature' => 'nullable|numeric|min:30|max:45',
            'notes' => 'nullable|string',
            'next_action' => 'nullable|string|max:255',
            'next_check_at' => 'nullable|date',
        ]);

        $followUp = MaternityFollowUp::create([
            ...$validated,
            'maternity_case_id' => $case->id,
            'user_id' => $request->user()->id,
        ]);

        $case->update([
            'pregnancy_status' => $this->pregnancyStatusForFollowUp($validated['type'], $case->pregnancy_status),
            'status' => $validated['type'] === 'labor_monitoring' ? 'labor' : $case->status,
            'fetal_heart_rate' => $validated['fetal_heart_rate'] ?? $case->fetal_heart_rate,
            'maternal_bp' => $validated['maternal_bp'] ?? $case->maternal_bp,
            'temperature' => $validated['temperature'] ?? $case->temperature,
            'last_checked_at' => now(),
            'alert_active' => $validated['type'] === 'emergency',
            'alert_reason' => $validated['type'] === 'emergency' ? ($validated['notes'] ?? 'Urgence maternité') : $case->alert_reason,
        ]);

        if ($validated['type'] === 'emergency') {
            $this->notifyRole('medecin', 'Urgence maternité',
                "Intervention demandée pour {$case->patient->first_name} {$case->patient->last_name}.",
                ['type' => 'maternity', 'maternity_case_id' => $case->id, 'priority' => 'urgent']
            );
        }

        return response()->json([
            'message' => 'Suivi maternité enregistré.',
            'follow_up' => $followUp->load('user:id,name,role'),
            'maternity_case' => $case->fresh(['patient', 'midwife', 'doctor']),
        ], 201);
    }

    public function deliver(Request $request, $id): JsonResponse
    {
        $case = MaternityCase::with('patient')->findOrFail($id);

        if ($case->status === 'discharged') {
            return response()->json(['message' => 'Ce dossier est déjà clôturé.'], 409);
        }

        $validated = $request->validate([
            'delivery_type' => 'required|string|in:vaginal,cesarean,assisted',
            'baby_gender' => 'nullable|string|in:male,female,unknown',
            'baby_weight' => 'nullable|numeric|min:0',
            'baby_apgar' => 'nullable|string|max:20',
            'notes' => 'nullable|string',
            'delivery_fee' => 'nullable|numeric|min:0',
        ]);

        return DB::transaction(function () use ($case, $validated, $request) {
            $case->update([
                'status' => 'delivered',
                'pregnancy_status' => 'postpartum',
                'delivery_date' => now(),
                'delivery_type' => $validated['delivery_type'],
                'baby_gender' => $validated['baby_gender'] ?? $case->baby_gender,
                'baby_weight' => $validated['baby_weight'] ?? $case->baby_weight,
                'baby_apgar' => $validated['baby_apgar'] ?? $case->baby_apgar,
                'notes' => trim(($case->notes ? $case->notes . "\n" : '') . ($validated['notes'] ?? '')),
                'last_checked_at' => now(),
                'alert_active' => false,
                'alert_reason' => null,
            ]);

            MaternityFollowUp::create([
                'maternity_case_id' => $case->id,
                'user_id' => $request->user()->id,
                'type' => 'delivery',
                'baby_weight' => $validated['baby_weight'] ?? null,
                'notes' => $validated['notes'] ?? null,
            ]);

            $fee = array_key_exists('delivery_fee', $validated)
                ? (float) $validated['delivery_fee']
                : WorkflowSettings::servicePrice('maternity_delivery_fee', 0);

            if ($fee > 0) {
                $invoice = $this->createMaternityInvoice($case, $fee, 'Accouchement maternité', 'delivery');
                $this->notifyRole('caisse', 'Facture maternité',
                    "Accouchement enregistré pour {$case->patient->first_name} {$case->patient->last_name}. Montant: " . number_format($fee, 0) . " FC.",
                    ['type' => 'billing', 'invoice_id' => $invoice->id, 'maternity_case_id' => $case->id]
                );
            }

            return response()->json([
                'message' => 'Accouchement enregistré.',
                'maternity_case' => $case->fresh(['patient', 'midwife', 'doctor', 'followUps']),
            ]);
        });
    }

    public function discharge(Request $request, $id): JsonResponse
    {
        $case = MaternityCase::with('patient')->findOrFail($id);

        if ($case->status === 'discharged') {
            return response()->json(['message' => 'Ce dossier est déjà sorti.'], 409);
        }

        $validated = $request->validate([
            'notes' => 'nullable|string',
            'next_action' => 'nullable|string|max:255',
        ]);

        $case->update([
            'status' => 'discharged',
            'discharge_date' => now(),
            'notes' => trim(($case->notes ? $case->notes . "\n" : '') . ($validated['notes'] ?? '')),
        ]);

        if ($case->visit_id) {
            Visit::whereKey($case->visit_id)->update([
                'current_service' => 'completed',
                'status' => 'completed',
            ]);
        }

        return response()->json([
            'message' => 'Sortie maternité enregistrée.',
            'maternity_case' => $case->fresh(['patient', 'midwife', 'doctor']),
        ]);
    }

    public function charge(Request $request, $id): JsonResponse
    {
        $case = MaternityCase::with('patient')->findOrFail($id);

        $validated = $request->validate([
            'label' => 'required|string|max:255',
            'amount' => 'required|numeric|min:0',
            'code' => 'nullable|string|max:80',
        ]);

        $invoice = $this->createMaternityInvoice($case, (float) $validated['amount'], $validated['label'], $validated['code'] ?? 'maternity_service');

        return response()->json([
            'message' => 'Facture maternité envoyée à la caisse.',
            'invoice' => $invoice,
        ], 201);
    }

    public function stats(): JsonResponse
    {
        $today = now()->startOfDay();
        $tomorrow = $today->copy()->addDay();

        $summary = MaternityCase::selectRaw("
                SUM(CASE WHEN status IN ('active', 'labor') THEN 1 ELSE 0 END) as active_count,
                SUM(CASE WHEN status = 'labor' THEN 1 ELSE 0 END) as labor_count,
                SUM(CASE WHEN risk_level IN ('high', 'emergency') AND status != 'discharged' THEN 1 ELSE 0 END) as high_risk_count,
                SUM(CASE WHEN delivery_date >= ? AND delivery_date < ? THEN 1 ELSE 0 END) as deliveries_today
            ", [$today, $tomorrow])
            ->first();

        $byRisk = MaternityCase::where('status', '!=', 'discharged')
            ->selectRaw('risk_level, COUNT(*) as count')
            ->groupBy('risk_level')
            ->get();

        return response()->json([
            'active_count' => (int) $summary->active_count,
            'labor_count' => (int) $summary->labor_count,
            'high_risk_count' => (int) $summary->high_risk_count,
            'deliveries_today' => (int) $summary->deliveries_today,
            'by_risk' => $byRisk,
        ]);
    }

    private function validateCase(Request $request, bool $creating = true): array
    {
        return $request->validate([
            'patient_id' => [$creating ? 'required' : 'sometimes', 'exists:patients,id'],
            'visit_id' => 'nullable|exists:visits,id',
            'status' => 'nullable|string|in:active,labor,delivered,referred,discharged',
            'pregnancy_status' => 'nullable|string|in:prenatal,labor,postpartum,neonatal',
            'gravida' => 'nullable|integer|min:0|max:20',
            'parity' => 'nullable|integer|min:0|max:20',
            'gestational_age_weeks' => 'nullable|integer|min:0|max:45',
            'last_menstrual_period' => 'nullable|date',
            'expected_delivery_date' => 'nullable|date',
            'admission_date' => 'nullable|date',
            'risk_level' => 'nullable|string|in:low,moderate,high,emergency',
            'risk_notes' => 'nullable|string',
            'fetal_heart_rate' => 'nullable|integer|min:0|max:260',
            'maternal_bp' => 'nullable|string|max:30',
            'temperature' => 'nullable|numeric|min:30|max:45',
            'notes' => 'nullable|string',
            'midwife_id' => 'nullable|exists:users,id',
            'doctor_id' => 'nullable|exists:users,id',
            'initial_fee' => 'nullable|numeric|min:0',
        ]);
    }

    private function createInitialInvoiceIfRequested(MaternityCase $case, Request $request): void
    {
        $fee = $request->filled('initial_fee')
            ? (float) $request->input('initial_fee')
            : WorkflowSettings::servicePrice('maternity_prenatal_fee', 0);

        if ($fee > 0) {
            $this->createMaternityInvoice($case, $fee, 'Ouverture dossier maternité', 'maternity_intake');
        }
    }

    private function createMaternityInvoice(MaternityCase $case, float $amount, string $label, string $code): Invoice
    {
        $patient = $case->patient ?: Patient::findOrFail($case->patient_id);

        return Invoice::create([
            'visit_id' => $case->visit_id,
            'patient_id' => $case->patient_id,
            'insurance_id' => $patient->is_insured ? $patient->insurance_id : null,
            'amount' => $amount,
            'status' => $patient->is_insured ? 'insurance_billed' : 'unpaid',
            'details' => $label,
            'service' => 'maternite',
            'item_count' => 1,
            'metadata' => [
                'type' => $code,
                'maternity_case_id' => $case->id,
                'label' => $label,
            ],
        ]);
    }

    private function pregnancyStatusForFollowUp(string $type, string $fallback): string
    {
        return match ($type) {
            'labor_monitoring' => 'labor',
            'delivery', 'postnatal' => 'postpartum',
            'neonatal' => 'neonatal',
            default => $fallback,
        };
    }
}
