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
        if ($request->has('q')) {
            $search = $request->string('q')->toString();
            $query->where(function ($inner) use ($search) {
                $inner->where('first_name', 'like', '%' . $search . '%')
                      ->orWhere('last_name', 'like', '%' . $search . '%')
                      ->orWhere('post_name', 'like', '%' . $search . '%')
                      ->orWhere('contact_info', 'like', '%' . $search . '%');
            });
        }
        return response()->json($query->orderBy('id', 'desc')->get());
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
            'consultation_fee' => 'nullable|numeric|min:0',
            'gender' => 'nullable|string|max:10'
        ]);

        // LOGIQUE DE VÉRIFICATION D'ASSURANCE
        if ($request->input('is_insured') && $request->filled('insurance_code')) {
            $insured = \App\Models\InsuredMember::where('insurance_id', $data['insurance_id'])
                ->where('membership_code', $data['insurance_code'])
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
        return response()->json(\App\Models\Insurance::all());
    }

    public function verifyInsurance(Request $request)
    {
        $request->validate([
            'insurance_id' => 'required|exists:insurances,id',
            'code' => 'required|string'
        ]);

        $member = \App\Models\InsuredMember::where('insurance_id', $request->insurance_id)
            ->where('membership_code', $request->code)
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

        $todayCount = Patient::where('created_at', '>=', $today)->count();
        $yesterdayCount = Patient::where('created_at', '>=', $yesterday)->where('created_at', '<', $today)->count();

        $insuredCount = Patient::where('created_at', '>=', $today)->where('is_insured', true)->count();
        $privateCount = Patient::where('created_at', '>=', $today)->where('is_insured', false)->count();

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
