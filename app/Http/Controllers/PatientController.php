<?php

namespace App\Http\Controllers;

use App\Models\Patient;
use App\Models\Visit;
use App\Models\Invoice;
use App\Support\WorkflowSettings;
use App\Traits\NotifiesUsers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PatientController extends Controller
{
    use NotifiesUsers;
    public function index(Request $request)
    {
        $query = Patient::query();

        if ($request->filled('q')) {
            $search = trim($request->string('q')->toString());
            $query->where(function ($inner) use ($search) {
                $inner->where('first_name', 'like', $search . '%')
                      ->orWhere('last_name', 'like', $search . '%')
                      ->orWhere('post_name', 'like', $search . '%')
                      ->orWhere('contact_info', 'like', '%' . $search . '%');
            });
        }

        // Filter by status
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        } elseif ($request->boolean('active_only')) {
            $query->where('status', 'active');
        }

        // On ne récupère que les colonnes nécessaires pour la liste
        $query->select(['id', 'first_name', 'last_name', 'post_name', 'is_insured', 'insurance_id', 'birth_year', 'created_at', 'pathology', 'status', 'death_date']);

        // Limite de sécurité pour éviter de saturer la mémoire en cas de gros volume
        $perPage = min(max($request->integer('per_page', 50), 10), 100);
        
        if ($request->boolean('nopaginate')) {
            return response()->json($query->orderBy('id', 'desc')->limit(200)->get());
        }

        return response()->json($query->orderBy('id', 'desc')->paginate($perPage));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'post_name' => 'nullable|string|max:255',
            'id' => 'nullable|exists:patients,id',
            'birth_year' => 'nullable|integer',
            'pathology' => 'nullable|string|max:255',
            'is_insured' => 'sometimes|boolean',
            'insurance_id' => 'nullable|exists:insurances,id',
            'insurance_code' => 'nullable|string',
            'contact_info' => 'nullable|string',
            'complaints' => 'nullable|string',
            'orientation' => 'nullable|string',
            'consultation_fee' => 'nullable|numeric|min:0',
            'gender' => 'nullable|string|max:10'
        ]);

        // LOGIQUE DE VÉRIFICATION D'ASSURANCE
        if ($request->input('is_insured')) {
            $insurance = \App\Models\Insurance::find($data['insurance_id'] ?? null);
            $insurance?->markExpiredIfNeeded();

            if (!$insurance || !$insurance->is_operational) {
                return response()->json([
                    'message' => "Le contrat de cette assurance est expiré ou inactif. Le patient ne peut pas être pris en charge par cette assurance."
                ], 422);
            }
        }

        if ($request->input('is_insured') && $request->filled('insurance_code')) {
            $insured = \App\Models\InsuredMember::where('insurance_id', $data['insurance_id'])
                ->where('membership_code', $data['insurance_code'])
                ->where('is_active', true)
                ->first();

            if (!$insured) {
                return response()->json([
                    'message' => 'Vérification échouée : Ce code d\'assuré n\'est pas valide ou n\'existe pas pour cette assurance.'
                ], 422);
            }
        }

        return DB::transaction(function () use ($data, $request) {
            if ($request->filled('id')) {
                $patient = Patient::find($data['id']);
            } else {
                $patient = Patient::where('first_name', $data['first_name'])
                    ->where('last_name', $data['last_name'])
                    ->when($request->filled('post_name'), function($q) use ($data) {
                        return $q->where('post_name', $data['post_name']);
                    })
                    ->first();
            }

            $message = 'Patient existant. Nouvelle visite créée.';

            if (!$patient) {
                $patient = Patient::create($data);
                $message = 'Nouveau patient enregistré.';
            } else {
                // Update existing patient info if provided
                $patient->update($data);
            }

            $isInsured = $patient->is_insured && $patient->insurance_id;
            
            // On récupère les prix du catalogue Admin
            $fichePrice = (float) WorkflowSettings::servicePrice('fiche_price', 5000);
            
            // On n'inclut plus les soins et la consultation par défaut dans la fiche d'accueil
            // sauf si spécifié explicitement (ex: urgence ou forfait combiné)
            $soinsPrice = (float) $request->input('soins_fee', 0); 
            $consultationPrice = (float) $request->input(
                'consultation_fee', 
                0
            );
            
            // Le montant initial est la somme des services réellement demandés
            $initialAmount = $fichePrice + $soinsPrice + $consultationPrice;

            $visit = Visit::create([
                'patient_id' => $patient->id,
                'current_service' => ($isInsured || $request->input('is_emergency')) ? 'soins' : 'caisse',
                'orientation' => $request->input('orientation') ?? 'medecin',
                'status' => 'pending',
                'complaints_notes' => ($request->input('is_emergency') ? '[URGENCE] ' : '') . ($data['complaints'] ?? ''),
                'lab_order_status' => 'none',
                'pharmacy_order_status' => 'none',
            ]);

            $invoice = Invoice::create([
                'visit_id' => $visit->id,
                'patient_id' => $patient->id,
                'insurance_id' => $isInsured ? $patient->insurance_id : null,
                'amount' => $initialAmount,
                'status' => $isInsured ? 'insurance_billed' : 'unpaid',
                'details' => $isInsured
                    ? 'Prise en charge assurance - parcours initial'
                    : 'Facture initiale: fiche, soins infirmiers et consultation',
                'service' => 'reception',
                'item_count' => 3,
                'metadata' => [
                    'workflow_step' => 'reception',
                    'line_items' => [
                        ['code' => 'fiche', 'label' => 'Fiche patient', 'price' => $fichePrice],
                        ['code' => 'soins', 'label' => 'Soins infirmiers', 'price' => $soinsPrice],
                        ['code' => 'consultation', 'label' => 'Consultation medicale', 'price' => $consultationPrice],
                    ],
                ],
            ]);

            // Notifications
            if (!$isInsured && !$request->input('is_emergency')) {
                $this->notifyRole('caisse', '💰 Nouvelle Facture', "Une nouvelle fiche de facturation est arrivée pour {$patient->first_name} {$patient->last_name}.", ['visit_id' => $visit->id]);
            } else {
                $this->notifyRole('soins', '🏥 Nouveau Patient', "Le patient {$patient->first_name} {$patient->last_name} est en attente au service des soins.", ['visit_id' => $visit->id]);
            }

            return response()->json([
                'message' => $message,
                'patient' => $patient->load('insurance'),
                'visit' => $visit,
                'invoice' => $invoice,
            ], 201);
        });
    }

    public function listInsurances()
    {
        \App\Models\Insurance::syncExpiredContracts();
        return response()->json(\App\Models\Insurance::select('id', 'name', 'status', 'contract_end_date', 'monthly_flat_fee')->orderBy('name')->get());
    }

    public function show($id)
    {
        $patient = Patient::with([
            'insurance',
            'visits' => function ($q) {
                $q->with(['doctor:id,name', 'labOrders.items', 'prescriptions.items', 'invoices'])
                  ->orderBy('created_at', 'desc');
            },
            'maternityCases.followUps'
        ])->findOrFail($id);

        // Build a consolidated timeline of care
        $timeline = $patient->visits->map(function ($visit) {
            return [
                'id' => $visit->id,
                'date' => $visit->created_at->toIso8601String(),
                'type' => 'consultation',
                'service' => $visit->orientation ?? 'Général',
                'doctor' => $visit->doctor?->name,
                'summary' => $visit->complaints_notes,
                'diagnosis' => $visit->diagnosis,
                'vitals' => $visit->vitals,
                'lab_orders' => $visit->labOrders,
                'prescriptions' => $visit->prescriptions,
                'invoices' => $visit->invoices,
                'discharge' => [
                    'date' => $visit->discharge_date,
                    'type' => $visit->discharge_type,
                    'summary' => $visit->discharge_summary,
                ]
            ];
        });

        return response()->json([
            'patient' => $patient,
            'timeline' => $timeline,
            'visit_count' => $patient->visits->count(),
            'last_visit' => $patient->visits->first(),
            'total_spent' => $patient->invoices->where('status', 'paid')->sum('amount'),
        ]);
    }

    public function verifyInsurance(Request $request)
    {
        $request->validate([
            'insurance_id' => 'required|exists:insurances,id',
            'code' => 'required|string'
        ]);

        $insurance = \App\Models\Insurance::findOrFail($request->insurance_id);
        $insurance->markExpiredIfNeeded();

        if (!$insurance->is_operational) {
            return response()->json([
                'success' => false,
                'status' => $insurance->status,
                'message' => "Le contrat {$insurance->name} est expiré ou inactif. Cette assurance ne peut plus couvrir les patients."
            ], 422);
        }

        $member = \App\Models\InsuredMember::where('insurance_id', $request->insurance_id)
            ->where('membership_code', $request->code)
            ->where('is_active', true)
            ->first();

        if ($member) {
            return response()->json([
                'success' => true,
                'member_name' => $member->member_name,
                'message' => 'Membre vérifié : ' . $member->member_name
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Aucun membre trouvé avec ce code pour cette assurance.'
        ], 404);
    }

    public function statsToday()
    {
        $today = now()->startOfDay();
        $yesterday = now()->subDay()->startOfDay();

        $stats = Patient::where('created_at', '>=', $yesterday)
            ->selectRaw('
                SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as today_count,
                SUM(CASE WHEN created_at >= ? AND created_at < ? THEN 1 ELSE 0 END) as yesterday_count,
                SUM(CASE WHEN created_at >= ? AND is_insured = 1 THEN 1 ELSE 0 END) as insured_count,
                SUM(CASE WHEN created_at >= ? AND is_insured = 0 THEN 1 ELSE 0 END) as private_count
            ', [$today, $yesterday, $today, $today, $today])
            ->first();

        $todayCount = (int) $stats->today_count;
        $yesterdayCount = (int) $stats->yesterday_count;
        $insuredCount = (int) $stats->insured_count;
        $privateCount = (int) $stats->private_count;

        return response()->json([
            'today_count' => $todayCount,
            'yesterday_count' => $yesterdayCount,
            'insured_count' => $insuredCount,
            'private_count' => $privateCount,
            'diff_percent' => $yesterdayCount > 0 ? round((($todayCount - $yesterdayCount) / $yesterdayCount) * 100) : ($todayCount > 0 ? 100 : 0)
        ]);
    }

    public function addCatalogItem(Request $request)
    {
        $data = $request->validate([
            'type' => 'required|string', // 'Examen' or other service types
            'label' => 'required|string',
            'price' => 'required|numeric|min:0',
        ]);

        if ($data['type'] === 'Examen') {
            $catalogJson = \App\Models\Setting::getValue('lab_tests_catalog', '[]');
            $catalog = json_decode($catalogJson, true) ?? [];
            
            // Generate unique code
            $code = strtoupper(preg_replace('/[^A-Z0-9]/', '', substr($data['label'], 0, 4))) . strtoupper(substr(uniqid(), -3));
            
            $catalog[] = [
                'code' => $code,
                'label' => $data['label'],
                'price' => $data['price']
            ];
            \App\Models\Setting::setValue('lab_tests_catalog', json_encode($catalog));
        } else {
            $catalogJson = \App\Models\Setting::getValue('other_prices_catalog', '[]');
            $catalog = json_decode($catalogJson, true) ?? [];
            $catalog[] = [
                'id' => uniqid('other_'),
                'type' => $data['type'],
                'label' => $data['label'],
                'price' => $data['price'],
                'locked' => false
            ];
            \App\Models\Setting::setValue('other_prices_catalog', json_encode($catalog));
        }

        return response()->json(['message' => 'Élément ajouté au catalogue avec succès.']);
    }
}
