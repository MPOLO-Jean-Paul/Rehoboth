<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Visit;
use App\Support\WorkflowSettings;
use App\Traits\NotifiesUsers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class VisitController extends Controller
{
    use NotifiesUsers;
    public function index(Request $request)
    {
        $user = $request->user();
        $role = $user->role;
        $perPage = min(max($request->integer('per_page', 20), 10), 100);

        $query = Visit::with([
            'patient:id,first_name,last_name,post_name,is_insured,insurance_id',
            'invoice',
        ]);

        // Filtrage par patient (Historique)
        if ($request->has('patient_id')) {
            $query->where('patient_id', $request->patient_id);
            return response()->json($query->orderBy('created_at', 'desc')->paginate($perPage));
        }

        if ($role === 'medecin') {
            // Doctors see only:
            // 1. Unassigned patients in the medecin queue
            // 2. Patients explicitly assigned to them
            $query->where('current_service', 'medecin')
                  ->where(function($q) use ($user) {
                      $q->whereNull('doctor_id')
                        ->orWhere('doctor_id', $user->id);
                  });
        } elseif ($role !== 'admin' && $role !== 'reception') {
            $query->where('current_service', $role);
        }

        $query->orderBy('updated_at', 'desc');

        if ($request->has('page') || $request->has('per_page')) {
            return response()->json($query->paginate($perPage));
        }

        return response()->json($query->limit(100)->get());
    }

    public function forward(Request $request, $id): JsonResponse
    {
        $validated = $request->validate([
            'next_service'              => 'required|string|in:medecin,labo,pharmacie,maternite,completed,soins',
            'notes'                     => 'nullable|string',
            'diagnosis'                 => 'nullable|string',
            'consultation_notes'        => 'nullable|string',
            'prescription_notes'        => 'nullable|string',
            'prescription_items'        => 'nullable|array',
            'prescription_items.*'      => 'nullable',   // accepts both string (legacy) and array (new)
            'prescription_items.*.medicine_id' => 'nullable|exists:medicines,id',
            'prescription_items.*.name' => 'nullable|string',
            'prescription_items.*.dosage' => 'nullable|string',
            'prescription_items.*.quantity' => 'nullable|integer|min:1',
            'prescription_items.*.price' => 'nullable|numeric|min:0',
            'prescription_items.*.instructions' => 'nullable|string',
            'lab_tests'                 => 'nullable|array',
            'lab_tests.*.code'          => 'required_with:lab_tests|string',
            'lab_tests.*.label'         => 'nullable|string',
            'lab_tests.*.price'         => 'nullable|numeric',
        ]);

        $visit = Visit::with('patient.insurance')->findOrFail($id);
        $user = $request->user();

        if ($user->role !== 'admin' && $visit->current_service !== $user->role) {
            return response()->json(['message' => 'Vous ne pouvez modifier qu\'une visite de votre service.'], 403);
        }

        if ($visit->status === 'completed') {
            return response()->json(['message' => 'Cette visite est deja terminee.'], 409);
        }

        try {
            return DB::transaction(function () use ($validated, $visit, $user) {
                $nextService = $validated['next_service'];
                $insurance = $visit->patient?->insurance;
                $insurance?->markExpiredIfNeeded();
                $isInsuranceOperational = $visit->patient?->is_insured && $insurance?->is_operational;
                $notes = trim((string) ($validated['notes'] ?? ''));
                $consultationNotes = trim((string) ($validated['consultation_notes'] ?? ''));
                $diagnosis = trim((string) ($validated['diagnosis'] ?? ''));
                $prescriptionNotes = trim((string) ($validated['prescription_notes'] ?? ''));
                $prescriptionItems = array_values(array_filter($validated['prescription_items'] ?? [], function($item) {
                    // Support both old string format and new object format
                    if (is_string($item)) return !empty(trim($item));
                    if (is_array($item)) return !empty(trim($item['name'] ?? ''));
                    return false;
                }));

                // Normalize items to always be objects
                $prescriptionItems = array_map(function($item) {
                    if (is_string($item)) {
                        // Legacy string format "Name - Dosage"
                        $parts = explode(' - ', $item, 2);
                        return [
                            'name'         => trim($parts[0]),
                            'dosage'       => trim($parts[1] ?? ''),
                            'instructions' => '',
                            'quantity'     => 1,
                            'price'        => 0,
                            'medicine_id'  => null,
                        ];
                    }
                    return [
                        'name'         => trim($item['name'] ?? ''),
                        'dosage'       => trim($item['dosage'] ?? ''),
                        'instructions' => trim($item['instructions'] ?? ''),
                        'quantity'     => intval($item['quantity'] ?? 1) ?: 1,
                        'price'        => floatval($item['price'] ?? 0),
                        'medicine_id'  => isset($item['medicine_id']) ? (int) $item['medicine_id'] : null,
                    ];
                }, $prescriptionItems);

                if ($diagnosis !== '') {
                    $visit->diagnosis = $diagnosis;
                }

                if ($consultationNotes !== '') {
                    $visit->consultation_notes = $consultationNotes;
                }

                $noteParts = [];
                if ($diagnosis !== '') {
                    $noteParts[] = 'Diagnostic: ' . $diagnosis;
                }
                if ($consultationNotes !== '') {
                    $noteParts[] = 'Consultation: ' . $consultationNotes;
                }
                if ($notes !== '') {
                    $noteParts[] = $notes;
                }
                $this->appendRoleNotes($visit, $user->role, implode(' | ', array_filter($noteParts)));

                if ($nextService === 'labo') {
                    $labTests = $this->resolveLabTests($validated['lab_tests'] ?? []);
                    if (count($labTests) === 0) {
                        return response()->json(['message' => 'Veuillez selectionner au moins un examen de laboratoire.'], 422);
                    }

                    $visit->lab_tests = $labTests;
                    $visit->lab_results = null;
                    $visit->lab_order_status = 'pending';
                    $visit->current_service = 'labo';
                    $visit->status = 'pending';
                    $visit->save();

                    $amount = collect($labTests)->sum('price');

                    Invoice::updateOrCreate([
                        'visit_id' => $visit->id,
                        'service' => 'labo',
                        'status' => $isInsuranceOperational ? 'insurance_billed' : 'unpaid',
                    ], [
                        'visit_id' => $visit->id,
                        'patient_id' => $visit->patient_id,
                        'insurance_id' => $isInsuranceOperational ? $visit->patient->insurance_id : null,
                        'amount' => $amount,
                        'details' => 'Bon de laboratoire: ' . implode(', ', array_column($labTests, 'label')),
                        'service' => 'labo',
                        'item_count' => count($labTests),
                        'metadata' => ['tests' => $labTests],
                    ]);

                    // NEW: Create Structured Lab Order
                    $labOrder = \App\Models\LabOrder::create([
                        'visit_id' => $visit->id,
                        'patient_id' => $visit->patient_id,
                        'doctor_id' => $user->id,
                        'clinical_notes' => $consultationNotes ?: $notes,
                        'status' => 'pending'
                    ]);
                    foreach ($labTests as $test) {
                        \App\Models\LabOrderItem::create([
                            'lab_order_id' => $labOrder->id,
                            'test_name' => $test['label'] ?? $test['code'],
                            'category' => $test['category'] ?? null,
                            'status' => 'pending'
                        ]);
                    }

                    $this->notifyRole('labo', '🧪 Nouvel Examen', "Un nouveau bon de labo est prêt pour {$visit->patient->first_name} {$visit->patient->last_name}.", ['visit_id' => $visit->id]);

                    return response()->json([
                        'message' => 'Bon de laboratoire envoyé au laboratoire.',
                        'visit' => $visit->fresh(['patient', 'invoice']),
                    ]);
                }

                if ($nextService === 'pharmacie') {
                    if ($prescriptionNotes === '' && count($prescriptionItems) === 0) {
                        return response()->json(['message' => 'Veuillez renseigner la prescription avant l\'envoi a la pharmacie.'], 422);
                    }

                    // --- CLEANUP PREVIOUS PENDING PRESCRIPTIONS ---
                    // If the doctor is re-sending, we should revert stock for the previous 'pending' items
                    $oldPrescription = \App\Models\Prescription::where('visit_id', $visit->id)
                        ->where('status', 'pending')
                        ->with('items')
                        ->first();

                    if ($oldPrescription) {
                        foreach ($oldPrescription->items as $oldItem) {
                        if ($oldItem->medicine_id && in_array($oldItem->status, ['pending', 'billed'], true)) {
                                $med = \App\Models\Medicine::find($oldItem->medicine_id);
                                if ($med) {
                                    $med->increment('stock_quantity', $oldItem->quantity_prescribed);
                                    \App\Models\StockMovement::create([
                                        'medicine_id' => $med->id,
                                        'type' => 'in',
                                        'quantity' => $oldItem->quantity_prescribed,
                                        'reason' => "Annulation/Correction prescription (Ordonnance #{$visit->id})",
                                        'user_id' => $user->id
                                    ]);
                                }
                            }
                        }
                        $oldPrescription->delete(); // Cascades to items if foreign key set, else manual delete
                    }

                    // Also check for existing unpaid invoice for pharmacy
                    $existingInvoice = \App\Models\Invoice::where('visit_id', $visit->id)
                        ->where('service', 'pharmacie')
                        ->whereIn('status', ['unpaid', 'insurance_billed'])
                        ->first();

                    $visit->prescription_notes = $prescriptionNotes;
                    $visit->prescription_items = $prescriptionItems;
                    $visit->pharmacy_order_status = $isInsuranceOperational ? 'insurance_billed' : 'pending_payment';
                    $visit->current_service = 'pharmacie';
                    $visit->status = 'pending';
                    $visit->save();

                    // NEW: Create Structured Prescription
                    $prescription = \App\Models\Prescription::create([
                        'visit_id' => $visit->id,
                        'patient_id' => $visit->patient_id,
                        'doctor_id' => $user->id,
                        'notes' => $prescriptionNotes,
                        'status' => 'pending'
                    ]);

                    $totalPharmacyAmount = 0;
                    $billedItems = [];

                    foreach ($prescriptionItems as $item) {
                        $medicine = null;
                        if (!empty($item['medicine_id'])) {
                            $medicine = \App\Models\Medicine::find($item['medicine_id']);
                        } else {
                            $medicine = \App\Models\Medicine::where('name', $item['name'])
                                ->orWhere('name', 'LIKE', '%' . $item['name'] . '%')
                                ->first();
                        }

                        $isAvailable = $medicine && $medicine->stock_quantity >= $item['quantity'];
                        
                        \App\Models\PrescriptionItem::create([
                            'prescription_id' => $prescription->id,
                            'medicine_id' => $medicine ? $medicine->id : null,
                            'medicine_name' => $item['name'],
                            'dosage' => $item['dosage'] ?? '',
                            'quantity_prescribed' => $item['quantity'],
                            'instructions' => $item['instructions'] ?? '',
                            'status' => $isAvailable ? 'pending' : 'out_of_stock'
                        ]);

                        if ($isAvailable) {
                            $itemAmount = ($medicine->price ?? 0) * $item['quantity'];
                            $totalPharmacyAmount += $itemAmount;
                            
                            $billedItems[] = [
                                'id' => $medicine->id,
                                'name' => $medicine->name,
                                'quantity' => $item['quantity'],
                                'price' => $medicine->price,
                                'total' => $itemAmount,
                                'dosage' => $item['dosage'] ?? $medicine->dosage,
                                'instructions' => $item['instructions'] ?? '',
                            ];

                            $medicine->decrement('stock_quantity', $item['quantity']);
                            \App\Models\StockMovement::create([
                                'medicine_id' => $medicine->id,
                                'type' => 'out',
                                'quantity' => $item['quantity'],
                                'reason' => "Facturation automatique (Ordonnance #{$visit->id})",
                                'user_id' => $user->id
                            ]);
                        }
                    }

                    if ($totalPharmacyAmount > 0) {
                        if ($existingInvoice) {
                            $existingInvoice->update([
                                'amount' => $totalPharmacyAmount,
                                'details' => 'Pharmacie: ' . count($billedItems) . ' produits (Mis à jour)',
                                'item_count' => count($billedItems),
                                'metadata' => ['items' => $billedItems],
                            ]);
                        } else {
                            \App\Models\Invoice::create([
                                'visit_id' => $visit->id,
                                'patient_id' => $visit->patient_id,
                                'insurance_id' => $isInsuranceOperational ? $visit->patient->insurance_id : null,
                                'amount' => $totalPharmacyAmount,
                                'status' => $isInsuranceOperational ? 'insurance_billed' : 'unpaid',
                                'details' => 'Pharmacie: ' . count($billedItems) . ' produits (Auto)',
                                'service' => 'pharmacie',
                                'item_count' => count($billedItems),
                                'metadata' => ['items' => $billedItems],
                            ]);
                        }
                    } elseif ($existingInvoice) {
                        $existingInvoice->delete(); // No items available anymore
                    }

                    // Notification
                    if ($isInsuranceOperational) {
                        $this->notifyRole('pharmacie', '💊 Nouvelle Ordonnance', "Une ordonnance est prête pour {$visit->patient->first_name} {$visit->patient->last_name}.", ['visit_id' => $visit->id]);
                    } else {
                        $this->notifyRole('pharmacie', '💊 Nouvelle Ordonnance', "Une ordonnance est en attente pour {$visit->patient->first_name} {$visit->patient->last_name}.", ['visit_id' => $visit->id]);
                    }

                    return response()->json([
                        'message' => 'Ordonnance envoyee a la pharmacie.',
                        'visit' => $visit->fresh(['patient', 'invoice']),
                    ]);
                }

                if ($nextService === 'maternite') {
                    \App\Models\MaternityCase::firstOrCreate(
                        ['visit_id' => $visit->id],
                        [
                            'patient_id' => $visit->patient_id,
                            'status' => 'active',
                            'pregnancy_status' => 'prenatal',
                            'risk_level' => 'moderate',
                            'doctor_id' => $user->role === 'medecin' ? $user->id : $visit->doctor_id,
                            'midwife_id' => $user->role === 'soins' ? $user->id : null,
                            'admission_date' => now(),
                            'notes' => $notes ?: 'Orientation vers la maternité',
                            'last_checked_at' => now(),
                        ]
                    );

                    $visit->current_service = 'maternite';
                    $visit->status = 'pending';
                    $visit->save();

                    $this->notifyRole('maternite', 'Patiente orientée en maternité', "La patiente {$visit->patient->first_name} {$visit->patient->last_name} est attendue en maternité.", ['type' => 'maternity', 'visit_id' => $visit->id]);

                    return response()->json([
                        'message' => 'Dossier transféré vers la maternité.',
                        'visit' => $visit->fresh(['patient', 'invoice']),
                    ]);
                }

                if ($nextService === 'completed') {
                    $visit->current_service = 'completed';
                    $visit->status = 'completed';
                    $visit->save();

                    return response()->json([
                        'message' => 'Consultation cloturee.',
                        'visit' => $visit->fresh(['patient', 'invoice']),
                    ]);
                }

                $visit->current_service = $nextService;
                $visit->status = 'pending';
                $visit->save();

                // Notifications for other services
                if ($nextService === 'soins') {
                    $this->notifyRole('soins', '🏥 Nouveau Patient', "Le patient {$visit->patient->first_name} {$visit->patient->last_name} a été transféré aux soins.", ['visit_id' => $visit->id]);
                } elseif ($nextService === 'medecin') {
                    if ($visit->doctor_id) {
                        $this->notifyUser($visit->doctor_id, '👨‍⚕️ Nouveau Patient', "Le patient {$visit->patient->first_name} {$visit->patient->last_name} est en attente dans votre cabinet.", ['visit_id' => $visit->id]);
                    } else {
                        $this->notifyRole('medecin', '👨‍⚕️ Nouveau Patient', "Le patient {$visit->patient->first_name} {$visit->patient->last_name} est en attente de consultation.", ['visit_id' => $visit->id]);
                    }
                }

                return response()->json([
                    'message' => 'Dossier transfere vers: ' . $nextService,
                    'visit' => $visit->fresh(['patient', 'invoice']),
                ]);
            });
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function myToday(Request $request)
    {
        $today = now()->startOfDay();
        $tomorrow = $today->copy()->addDay();
        $user = $request->user();
        $perPage = min(max($request->integer('per_page', 30), 10), 100);

        $visits = Visit::with(['patient:id,first_name,last_name'])
            ->where('updated_at', '>=', $today)
            ->where('updated_at', '<', $tomorrow)
            ->where(function ($q) use ($user) {
                $q->where('current_service', $user->role)
                  ->orWhere('complaints_notes', 'like', '%[' . strtoupper($user->role) . ']%');
            })
            ->orderBy('updated_at', 'desc')
            ->paginate($perPage);

        return response()->json($visits);
    }

    public function soinsPatients(Request $request)
    {
        $perPage = min(max($request->integer('per_page', 50), 10), 100);

        $visits = Visit::with(['patient:id,first_name,last_name,post_name,is_insured,insurance_id'])
            ->where('current_service', 'soins')
            ->where('status', '!=', 'completed')
            ->orderBy('updated_at', 'desc')
            ->paginate($perPage);

        return response()->json($visits);
    }

    public function transfer(Request $request)
    {
        $validated = $request->validate([
            'visit_id' => 'required|exists:visits,id',
            'next_service' => 'nullable|string|in:medecin,completed,pharmacie,maternite',
            'doctor_id' => 'nullable|exists:users,id',
            'notes' => 'nullable|string',
            'vitals' => 'nullable|array',
            'vitals.temperature' => 'nullable|string',
            'vitals.blood_pressure' => 'nullable|string',
            'vitals.weight' => 'nullable|string',
            'vitals.height' => 'nullable|string',
            'vitals.pulse' => 'nullable|string',
            'vitals.respiratory_rate' => 'nullable|string',
            'vitals.oxygen_saturation' => 'nullable|string',
            'prescription_items' => 'nullable|array',
            'prescription_items.*.medicine_id' => 'nullable|exists:medicines,id',
            'prescription_items.*.name' => 'nullable|string',
            'prescription_items.*.quantity' => 'nullable|integer',
            'prescription_items.*.dosage' => 'nullable|string',
            'prescription_items.*.price' => 'nullable|numeric|min:0',
            'prescription_items.*.instructions' => 'nullable|string',
        ]);

        $visit = Visit::with('patient')->findOrFail($validated['visit_id']);
        $nextService = $validated['next_service'] ?? 'medecin';
        $vitals = array_filter($validated['vitals'] ?? [], fn ($value) => $value !== null && $value !== '');
        $notes = trim((string) ($validated['notes'] ?? ''));
        $user = $request->user();

        // Use the same transfer/facturation path for specialized services.
        if (in_array($nextService, ['pharmacie', 'maternite'], true)) {
            // Repurpose forward logic for pharmacie
            $request->request->add(['next_service' => $nextService, 'notes' => $notes]);
            return $this->forward($request, $visit->id);
        }

        $visit->vitals = $vitals ?: null;
        $visit->nursing_notes = $notes !== '' ? $notes : null;
        $visit->current_service = $nextService;
        $visit->doctor_id = $validated['doctor_id'] ?? $visit->doctor_id;
        $visit->status = $nextService === 'completed' ? 'completed' : 'pending';
        $this->appendRoleNotes($visit, 'soins', $this->formatSoinsNotes($vitals, $notes));
        $visit->save();

        // Notification Medecin
        if ($nextService === 'medecin') {
            if ($visit->doctor_id) {
                $this->notifyUser($visit->doctor_id, '👨‍⚕️ Nouveau Patient', "Le patient {$visit->patient->first_name} {$visit->patient->last_name} a été préparé et vous est transféré.", ['visit_id' => $visit->id]);
            } else {
                $this->notifyRole('medecin', '👨‍⚕️ Nouveau Patient', "Le patient {$visit->patient->first_name} {$visit->patient->last_name} est prêt pour consultation.", ['visit_id' => $visit->id]);
            }
        }

        return response()->json([
            'message' => 'Dossier transféré avec succès.',
            'visit' => $visit->fresh(['patient', 'invoice']),
        ]);
    }

    public function getDoctors(): JsonResponse
    {
        $doctors = \App\Models\User::where('role', 'medecin')->get(['id', 'name', 'specialty']);
        return response()->json($doctors);
    }

    public function workflowCatalog(): JsonResponse
    {
        return response()->json([
            'service_prices' => WorkflowSettings::servicePrices(),
            'lab_tests' => WorkflowSettings::labTestsCatalog(),
            'other_prices' => WorkflowSettings::otherPricesCatalog(),
        ]);
    }

    private function resolveLabTests(array $requestedTests): array
    {
        $catalog = WorkflowSettings::labTestsByCode();
        $resolved = [];

        foreach ($requestedTests as $test) {
            $code = strtoupper(trim($test['code'] ?? ''));
            if ($code === '') continue;

            if (isset($catalog[$code])) {
                // Use catalog values, but keep price from request if catalog has 0
                $item = $catalog[$code];
                if (empty($item['price']) && !empty($test['price'])) {
                    $item['price'] = floatval($test['price']);
                }
                $resolved[] = $item;
            } else {
                // Code not in catalog — use values provided by doctor (graceful fallback)
                $resolved[] = [
                    'code'  => $code,
                    'label' => $test['label'] ?? $code,
                    'price' => floatval($test['price'] ?? 0),
                ];
            }
        }

        return array_values($resolved);
    }

    private function formatSoinsNotes(array $vitals, string $notes): string
    {
        $parts = [];

        if ($vitals) {
            $labels = [
                'temperature' => 'T',
                'blood_pressure' => 'TA',
                'weight' => 'Poids',
                'height' => 'Taille',
                'pulse' => 'Pouls',
                'respiratory_rate' => 'FR',
                'oxygen_saturation' => 'SpO2',
            ];

            $formattedVitals = [];
            foreach ($vitals as $key => $value) {
                $formattedVitals[] = ($labels[$key] ?? $key) . ': ' . $value;
            }
            if ($formattedVitals) {
                $parts[] = 'Constantes ' . implode(', ', $formattedVitals);
            }
        }

        if ($notes !== '') {
            $parts[] = $notes;
        }

        return implode(' | ', $parts);
    }

    private function appendRoleNotes(Visit $visit, string $role, string $notes): void
    {
        $notes = trim($notes);
        if ($notes === '') {
            return;
        }

        $prefix = $visit->complaints_notes ? "\n" : '';
        $visit->complaints_notes = ($visit->complaints_notes ?? '') . $prefix . '[' . strtoupper($role) . '] ' . $notes;
    }
}
