<?php

namespace App\Http\Controllers;

use App\Models\StaffMessage;
use App\Models\StaffMessageRead;
use App\Models\User;
use App\Models\Patient;
use App\Models\Visit;
use App\Models\Invoice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Models\Medicine;
use App\Models\Setting;
use App\Models\Insurance;
use App\Models\InsuredMember;
use App\Support\WorkflowSettings;
use Carbon\Carbon;
use Illuminate\Support\Facades\Response;

class AdminController extends Controller
{
    use \App\Traits\NotifiesUsers;
    public function dashboard(Request $request)
    {
        return response()->json($this->buildDashboardStats($request));
    }

    private function buildDashboardStats(Request $request): array
    {
        $period = $request->get('period', 'day'); // day, week, month

        $monthStart = Carbon::now()->startOfMonth()->startOfDay();
        $startDate = match ($period) {
            'week' => Carbon::now()->startOfWeek()->lt($monthStart) ? $monthStart : Carbon::now()->startOfWeek()->startOfDay(),
            'month' => $monthStart,
            'semester' => Carbon::now()->month > 6 ? Carbon::now()->month(7)->startOfMonth()->startOfDay() : Carbon::now()->startOfYear()->startOfDay(),
            'year' => Carbon::now()->startOfYear()->startOfDay(),
            default => Carbon::today()->startOfDay()->lt($monthStart) ? $monthStart : Carbon::today()->startOfDay(),
        };

        // Aggregated query for revenue by service - MUCH FASTER than get()->groupBy()
        $revenueByServiceRaw = Invoice::whereIn('status', ['paid', 'insurance_billed', 'settled'])
            ->where('created_at', '>=', $startDate)
            ->selectRaw('LOWER(service) as service_slug, SUM(amount) as total')
            ->groupBy('service_slug')
            ->pluck('total', 'service_slug');

        $totalRevenue = $revenueByServiceRaw->sum();

        $coreServices = ['reception', 'labo', 'pharmacie', 'soins', 'maternite', 'caisse', 'consultation'];
        $serviceNames = [
            'reception' => 'Frais de Dossier',
            'labo'      => 'Laboratoire',
            'pharmacie' => 'Pharmacie',
            'soins'     => 'Soins Infirmiers',
            'maternite' => 'Maternité',
            'caisse'    => 'Encaissements Directs',
            'consultation' => 'Consultations'
        ];

        $revenueByService = collect($coreServices)->map(function($slug) use ($revenueByServiceRaw, $serviceNames) {
            return [
                'service' => $serviceNames[$slug],
                'total' => (int) ($revenueByServiceRaw->get($slug, 0))
            ];
        })->values();

        // Optimized counts with indexed columns
        $patientsCount = Patient::where('created_at', '>=', $startDate)->count();
        $visitsCount = Visit::where('created_at', '>=', $startDate)->count();
        $labCount = Visit::where('current_service', 'labo')
            ->where('created_at', '>=', $startDate)
            ->count();

        return [
            'total_patients_period' => $patientsCount,
            'total_visits_period' => $visitsCount,
            'revenue_period' => $totalRevenue,
            'revenue_by_service' => $revenueByService,
            'lab_period_count' => $labCount,
            'period' => $period,
            'visits_by_service' => Visit::selectRaw('current_service, count(*) as count')
                                        ->where('status', '!=', 'completed')
                                        ->groupBy('current_service')
                                        ->get(),
            'top_insurances' => Insurance::withCount('patients')
                                        ->orderByDesc('patients_count')
                                        ->limit(3)
                                        ->get()
                                        ->map(function($ins) {
                                            return [
                                                'insurance_company' => $ins->name,
                                                'count' => $ins->patients_count
                                            ];
                                        }),
            'low_stock_medicines' => Medicine::whereRaw('stock_quantity <= low_stock_threshold')
                                             ->select('name', 'stock_quantity')
                                             ->get(),
        ];
    }

    // GESTION DES ASSURANCES - OPTIMIZED N+1
    public function getInsurances()
    {
        \App\Models\Insurance::syncExpiredContracts();

        // 1. Get base data
        $insurances = \App\Models\Insurance::withCount(['patients', 'insuredMembers'])->get();
        
        // 2. Get all consumptions in ONE query instead of N
        $consumptions = \App\Models\Invoice::join('patients', 'invoices.patient_id', '=', 'patients.id')
            ->whereNotNull('patients.insurance_id')
            ->selectRaw('patients.insurance_id, SUM(invoices.amount) as total')
            ->groupBy('patients.insurance_id')
            ->pluck('total', 'insurance_id');

        $results = $insurances->map(function($ins) use ($consumptions) {
            return array_merge($ins->toArray(), [
                'real_consumption' => (int) $consumptions->get($ins->id, 0),
                'patients_count' => (int) $ins->patients_count,
                'insured_members_count' => (int) $ins->insured_members_count
            ]);
        });

        return response()->json($results);
    }

    public function createInsurance(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'contract_date' => 'nullable|string',
            'contract_end_date' => 'nullable|string',
            'monthly_flat_fee' => 'required|numeric|min:0',
            'contact_info' => 'nullable|string',
            'contract_type' => 'nullable|string|in:mensuel,trimestriel,annuel',
            'status' => 'nullable|string|in:active,suspended,terminated,expired'
        ]);

        $dateError = $this->normalizeInsuranceDates($data);
        if ($dateError) return $dateError;

        $insurance = \App\Models\Insurance::create($data);
        return response()->json(['message' => 'Assurance créée avec succès', 'insurance' => $insurance]);
    }

    public function updateInsurance(Request $request, $id)
    {
        $insurance = \App\Models\Insurance::findOrFail($id);
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'contract_date' => 'nullable|string',
            'contract_end_date' => 'nullable|string',
            'monthly_flat_fee' => 'required|numeric|min:0',
            'contact_info' => 'nullable|string',
            'contract_type' => 'nullable|string|in:mensuel,trimestriel,annuel',
            'status' => 'nullable|string|in:active,suspended,terminated,expired'
        ]);

        $dateError = $this->normalizeInsuranceDates($data);
        if ($dateError) return $dateError;

        $insurance->update($data);
        return response()->json(['message' => 'Assurance mise à jour', 'insurance' => $insurance]);
    }

    public function renewInsurance(Request $request, $id)
    {
        $insurance = \App\Models\Insurance::findOrFail($id);
        $data = $request->validate([
            'contract_date' => 'nullable|string',
            'contract_end_date' => 'required|string',
            'monthly_flat_fee' => 'nullable|numeric|min:0',
            'contract_type' => 'nullable|string|in:mensuel,trimestriel,annuel',
        ]);

        $data['contract_date'] = $data['contract_date'] ?? now()->toDateString();
        $dateError = $this->normalizeInsuranceDates($data);
        if ($dateError) return $dateError;

        $insurance->update(array_filter([
            'contract_date' => $data['contract_date'],
            'contract_end_date' => $data['contract_end_date'],
            'monthly_flat_fee' => $data['monthly_flat_fee'] ?? null,
            'contract_type' => $data['contract_type'] ?? null,
            'status' => 'active',
        ], fn ($value) => $value !== null));

        return response()->json([
            'message' => "Contrat {$insurance->name} renouvelé et réactivé.",
            'insurance' => $insurance->fresh(),
        ]);
    }

    public function addInsuredMember(Request $request)
    {
        $data = $request->validate([
            'insurance_id' => 'required|exists:insurances,id',
            'member_name' => 'required|string',
            'membership_code' => 'required|string|unique:insured_members,membership_code,NULL,id,insurance_id,'.$request->insurance_id
        ]);

        $member = InsuredMember::create([
            'insurance_id' => $data['insurance_id'],
            'member_name' => $data['member_name'],
            'membership_code' => $data['membership_code']
        ]);
        return response()->json(['message' => 'Membre ajouté à la liste', 'member' => $member]);
    }

    public function updateInsuredMember(Request $request, $id)
    {
        $member = \App\Models\InsuredMember::findOrFail($id);
        $data = $request->validate([
            'member_name' => 'required|string',
            'membership_code' => 'required|string|unique:insured_members,membership_code,'.$id.',id,insurance_id,'.$member->insurance_id
        ]);

        $member->update($data);
        return response()->json(['message' => 'Membre mis à jour', 'member' => $member]);
    }

    public function deleteInsuredMember($id)
    {
        $member = \App\Models\InsuredMember::findOrFail($id);
        $member->delete();
        return response()->json(['message' => 'Membre supprimé de la liste']);
    }

    public function getInsuredMembers($insuranceId)
    {
        return response()->json(\App\Models\InsuredMember::where('insurance_id', $insuranceId)->get());
    }

    public function deleteInsurance($id)
    {
        $insurance = \App\Models\Insurance::findOrFail($id);
        $insurance->delete();
        return response()->json(['message' => 'Contrat d\'assurance supprimé']);
    }

    public function getMessages(Request $request)
    {
        $user = $request->user();
        $perPage = min((int) $request->get('per_page', 30), 100);

        $baseQuery = StaffMessage::where(function ($query) use ($user) {
            // Always include messages sent by the user
            $query->where('sender_id', $user->id)
                  // AND messages sent to their role (excluding their own)
                  ->orWhere(function ($q) use ($user) {
                      $q->where('sender_id', '!=', $user->id)
                        ->where(function ($q2) use ($user) {
                            $q2->whereNull('target_role')
                               ->orWhere('target_role', $user->role);
                        });
                  });
        })->whereDoesntHave('reads', function($q) use ($user) {
            $q->where('user_id', $user->id)->whereNotNull('deleted_at');
        });

        $query = (clone $baseQuery)
            ->with('sender:id,name,role')
            ->withExists([
                'reads as is_read_by_me' => fn ($query) => $query->where('user_id', $user->id),
            ])
            ->latest();

        if ($request->boolean('unread')) {
            $query->where('sender_id', '!=', $user->id)
                  ->whereDoesntHave('reads', fn ($query) => $query->where('user_id', $user->id));
        }

        $messages = $query->paginate($perPage);
        $unreadCount = (clone $baseQuery)
            ->where('sender_id', '!=', $user->id)
            ->whereDoesntHave('reads', fn ($query) => $query->where('user_id', $user->id))
            ->count();

        // Ensure sent messages are marked as read_by_me in the response
        $items = collect($messages->items())->map(function($msg) use ($user) {
            if ($msg->sender_id === $user->id) {
                $msg->is_read_by_me = true;
                $msg->is_sender = true;
            } else {
                $msg->is_sender = false;
            }
            return $msg;
        });

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $messages->currentPage(),
                'last_page' => $messages->lastPage(),
                'per_page' => $messages->perPage(),
                'total' => $messages->total(),
                'unread_count' => $unreadCount,
            ],
        ]);
    }

    public function markMessageAsRead(Request $request, $id)
    {
        $user = $request->user();
        $message = StaffMessage::where(function ($query) use ($user) {
            $query->whereNull('target_role')
                ->orWhere('target_role', $user->role);
        })->findOrFail($id);

        StaffMessageRead::firstOrCreate(
            ['staff_message_id' => $message->id, 'user_id' => $user->id],
            ['read_at' => now()]
        );

        return response()->json(['message' => 'Message marqué comme lu']);
    }

    public function deleteMessage(Request $request, $id)
    {
        $user = $request->user();

        // Find the message visible to this user
        $message = StaffMessage::where(function ($query) use ($user) {
            $query->where('sender_id', $user->id)
                  ->orWhereNull('target_role')
                  ->orWhere('target_role', $user->role);
        })->findOrFail($id);

        // Admin who sent the message can permanently delete it
        if ($user->role === 'admin' && (int)$message->sender_id === (int)$user->id) {
            // Hard delete – remove all reads records first, then the message
            StaffMessageRead::where('staff_message_id', $message->id)->delete();
            $message->delete();
            return response()->json(['message' => 'Message définitivement supprimé']);
        }

        // Other users: soft-delete via the reads pivot table
        // Use raw upsert to avoid unique constraint violation
        \DB::table('staff_message_reads')->upsert(
            [
                'staff_message_id' => $message->id,
                'user_id'          => $user->id,
                'deleted_at'       => now(),
                'read_at'          => now(),
                'created_at'       => now(),
                'updated_at'       => now(),
            ],
            ['staff_message_id', 'user_id'],   // unique keys
            ['deleted_at', 'updated_at']        // columns to update on conflict
        );

        return response()->json(['message' => 'Message supprimé']);
    }

    public function markAllMessagesAsRead(Request $request)
    {
        $user = $request->user();
        $now = now();
        $messageIds = StaffMessage::where(function ($query) use ($user) {
            $query->whereNull('target_role')
                ->orWhere('target_role', $user->role);
        })->where('sender_id', '!=', $user->id)->pluck('id');

        if ($messageIds->isNotEmpty()) {
            \DB::table('staff_message_reads')->upsert(
                $messageIds->map(fn ($messageId) => [
                    'staff_message_id' => $messageId,
                    'user_id' => $user->id,
                    'read_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->all(),
                ['staff_message_id', 'user_id'],
                ['read_at', 'updated_at']
            );
        }

        return response()->json(['message' => 'Tous les messages ont été marqués comme lus']);
    }

    public function updateMessage(Request $request, $id)
    {
        $message = StaffMessage::where('sender_id', $request->user()->id)->findOrFail($id);
        
        $validated = $request->validate([
            'subject' => 'required|string',
            'message' => 'required|string',
            'target_role' => 'nullable|string|in:reception,caisse,medecin,labo,soins,pharmacie,maternite,admin',
            'priority' => 'nullable|string|in:normal,important,urgent',
        ]);

        $message->update([
            'target_role' => $validated['target_role'] ?? null,
            'subject' => $validated['subject'],
            'message' => $validated['message'],
            'priority' => $validated['priority'] ?? 'normal',
        ]);

        return response()->json(['message' => 'Message modifié avec succès', 'data' => $message]);
    }

    public function broadcastMail(Request $request)
    {
        $validated = $request->validate([
            'subject' => 'required|string',
            'message' => 'required|string',
            'target_role' => 'nullable|string|in:reception,caisse,medecin,labo,soins,pharmacie,maternite,admin',
            'priority' => 'nullable|string|in:normal,important,urgent',
        ]);

        $msg = StaffMessage::create([
            'sender_id' => $request->user()->id,
            'target_role' => $validated['target_role'] ?? null,
            'subject' => $validated['subject'],
            'message' => $validated['message'],
            'priority' => $validated['priority'] ?? 'normal',
            'is_read' => false,
        ]);

        $targetRole = $validated['target_role'] ?? null;
        $priority = $validated['priority'] ?? 'normal';

        $roles = $targetRole
            ? [$targetRole]
            : ['reception', 'caisse', 'medecin', 'labo', 'soins', 'pharmacie', 'maternite', 'admin'];

        foreach ($roles as $role) {
            $this->notifyRole($role, '📢 ' . $validated['subject'], $validated['message'], [
                'type' => $priority,
                'message_id' => $msg->id,
                'priority' => $priority,
            ]);
        }

        return response()->json(['message' => 'Message diffusé avec succès à tous les agents.']);
    }

    public function getUsers()
    {
        return response()->json(User::select('id', 'name', 'postname', 'phone', 'email', 'role', 'specialty', 'profile_picture')->orderBy('role')->orderBy('name')->get());
    }

    public function createUser(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'postname' => 'nullable|string',
            'phone' => 'nullable|string',
            'email' => 'required|email|unique:users',
            'password' => 'required|string|min:6',
            'role' => 'required|string|in:admin,reception,caisse,medecin,labo,soins,pharmacie,maternite',
            'specialty' => 'nullable|string'
        ]);

        $user = User::create([
            'name' => $data['name'],
            'postname' => $data['postname'] ?? null,
            'phone' => $data['phone'] ?? null,
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role' => $data['role'],
            'specialty' => $data['specialty'] ?? null
        ]);

        return response()->json(['message' => 'Personnel créé', 'user' => $user]);
    }

    public function updateUser(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $data = $request->validate([
            'name' => 'required|string',
            'postname' => 'nullable|string',
            'phone' => 'nullable|string',
            'email' => 'required|email|unique:users,email,'.$id,
            'role' => 'required|string|in:admin,reception,caisse,medecin,labo,soins,pharmacie,maternite',
            'specialty' => 'nullable|string'
        ]);

        $user->update([
            'name' => $data['name'],
            'postname' => $data['postname'] ?? null,
            'phone' => $data['phone'] ?? null,
            'email' => $data['email'],
            'role' => $data['role'],
            'specialty' => $data['specialty'] ?? null
        ]);

        return response()->json(['message' => 'Utilisateur mis à jour', 'user' => $user]);
    }

    public function resetPassword(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $data = $request->validate([
            'password' => 'required|string|min:6',
        ]);

        $user->update([
            'password' => Hash::make($data['password']),
        ]);

        return response()->json(['message' => 'Mot de passe réinitialisé']);
    }

    public function deleteUser($id)
    {
        $user = User::findOrFail($id);
        
        // Prevent deleting the last admin if needed, but for now simple delete
        $user->delete();

        return response()->json(['message' => 'Utilisateur supprimé']);
    }

    /**
     * Maladies les plus fréquentes sur une période donnée (en jours)
     */
    public function getDiseases(Request $request)
    {
        $days = (int) $request->get('days', 7);

        $diseases = Visit::selectRaw('diagnosis as name, count(*) as count')
            ->whereNotNull('diagnosis')
            ->where('diagnosis', '!=', '')
            ->where('created_at', '>=', Carbon::now()->subDays($days)->startOfDay())
            ->groupBy('diagnosis')
            ->orderByDesc('count')
            ->limit(10)
            ->get();

        $total = $diseases->sum('count');

        $result = $diseases->map(function ($d) use ($total) {
            return [
                'name'       => $d->name,
                'count'      => $d->count,
                'percentage' => $total > 0 ? round(($d->count / $total) * 100) : 0,
            ];
        });

        return response()->json($result);
    }

    /**
     * Produits bientôt expirés (30 jours), déjà expirés et stock bas
     */
    public function getStockExpiry()
    {
        $soon = Carbon::now()->addDays(30);
        $now = Carbon::now();

        $expiring = Medicine::whereNotNull('expiry_date')
            ->where('expiry_date', '>', $now->toDateString())
            ->where('expiry_date', '<=', $soon->toDateString())
            ->select('name', 'stock_quantity as quantity', 'expiry_date as expires_at')
            ->orderBy('expiry_date')
            ->get();

        $expired = Medicine::whereNotNull('expiry_date')
            ->where('expiry_date', '<=', $now->toDateString())
            ->select('name', 'stock_quantity as quantity', 'expiry_date as expires_at')
            ->orderBy('expiry_date')
            ->get();

        $lowStock = Medicine::whereRaw('stock_quantity <= low_stock_threshold')
            ->select('name', 'stock_quantity as quantity', 'low_stock_threshold')
            ->get();

        return response()->json([
            'expiring' => $expiring,
            'expired'  => $expired,
            'low_stock' => $lowStock,
            'pharmacy_health' => [
                'is_stable' => $expired->count() === 0 && $lowStock->count() === 0,
                'alert_level' => $expired->count() > 0 ? 'critical' : ($lowStock->count() > 0 ? 'warning' : 'good')
            ]
        ]);
    }

    /**
     * Entrées de caisse par service sur une période (day, week, month)
     */
    public function getCashToday(Request $request)
    {
        $period = $request->get('period', 'day');
        $monthStart = Carbon::now()->startOfMonth()->startOfDay();
        $startDate = match($period) {
            'week' => Carbon::now()->startOfWeek()->lt($monthStart) ? $monthStart : Carbon::now()->startOfWeek()->startOfDay(),
            'month' => $monthStart,
            'semester' => Carbon::now()->month > 6 ? Carbon::now()->month(7)->startOfMonth()->startOfDay() : Carbon::now()->startOfYear()->startOfDay(),
            'year' => Carbon::now()->startOfYear()->startOfDay(),
            default => Carbon::today()->startOfDay()->lt($monthStart) ? $monthStart : Carbon::today()->startOfDay(),
        };

        $byService = Invoice::where('created_at', '>=', $startDate)
            ->whereIn('status', ['paid', 'insurance_billed', 'settled'])
            ->selectRaw('service, SUM(amount) as amount, COUNT(*) as count')
            ->groupBy('service')
            ->orderByDesc('amount')
            ->get();

        $patientStats = Patient::where('created_at', '>=', $startDate)
            ->selectRaw('COUNT(*) as total, SUM(CASE WHEN is_insured = 1 THEN 1 ELSE 0 END) as insured, SUM(CASE WHEN is_insured = 0 THEN 1 ELSE 0 END) as private')
            ->first();

        $patientCount = (int) $patientStats->total;
        $insuredCount = (int) $patientStats->insured;
        $privateCount = (int) $patientStats->private;

        $serviceColors = [
            'reception' => '#3B82F6',
            'labo'      => '#F59E0B',
            'pharmacie' => '#8B5CF6',
            'soins'     => '#10B981',
            'maternite' => '#EC4899',
            'caisse'    => '#FF385C',
            'consultation' => '#6366F1'
        ];

        $serviceNames = [
            'reception' => 'Frais de Dossier',
            'labo'      => 'Laboratoire',
            'pharmacie' => 'Pharmacie',
            'soins'     => 'Soins Infirmiers',
            'maternite' => 'Maternité',
            'caisse'    => 'Encaissements Directs',
            'consultation' => 'Consultations Médicales'
        ];

        $items = $byService->map(function ($row) use ($serviceColors, $serviceNames) {
            $key = strtolower($row->service ?? 'reception');
            return [
                'service' => $serviceNames[$key] ?? ucfirst($row->service ?? 'Inconnu'),
                'amount'  => (int) $row->amount,
                'count'   => (int) $row->count,
                'color'   => $serviceColors[$key] ?? '#64748B',
                'key'     => $key
            ];
        });

        return response()->json([
            'items' => $items,
            'patient_count' => $patientCount,
            'insured_count' => $insuredCount,
            'private_count' => $privateCount,
            'period' => $period
        ]);
    }

    public function getSettings()
    {
        $defaults = [
            'fiche_price' => '5000',
            'soins_price' => '0',
            'consultation_price' => '0',
            'maternity_prenatal_fee' => '0',
            'maternity_delivery_fee' => '0',
            'lab_tests_catalog' => json_encode(WorkflowSettings::defaultLabTestsCatalog()),
        ];

        foreach ($defaults as $key => $value) {
            Setting::setValue($key, Setting::getValue($key, $value));
        }

        return response()->json(Setting::all());
    }

    public function updateSetting(Request $request)
    {
        $request->validate([
            'key' => 'required|string',
            'value' => 'required|string'
        ]);

        $setting = Setting::setValue($request->key, $request->value);
        return response()->json(['message' => 'Paramètre mis à jour', 'setting' => $setting]);
    }

    public function updateSettingsBulk(Request $request)
    {
        $data = $request->validate([
            'settings' => 'required|array|min:1',
        ]);

        $saved = [];
        $otherCatalog = null;

        foreach ($data['settings'] as $key => $value) {
            $valToStore = is_array($value) ? json_encode($value) : (string) $value;
            $saved[] = Setting::setValue((string) $key, $valToStore);
            
            if ($key === 'other_prices_catalog' && is_array($value)) {
                $otherCatalog = $value;
            }
        }

        // Deep Synchronization if other_prices_catalog was updated
        if ($otherCatalog) {
            $labTests = json_decode(Setting::getValue('lab_tests_catalog', '[]'), true) ?? [];
            
            foreach ($otherCatalog as $item) {
                $type = $item['type'] ?? 'Autre';
                $label = $item['label'] ?? null;
                $price = (float) ($item['price'] ?? 0);
                $dosage = $item['dosage'] ?? null;

                if (!$label) continue;

                // 1. Sync MEDICINES (Pharmacy)
                if ($type === 'Produit') {
                    $medicine = Medicine::firstOrNew(['name' => $label]);
                    $medicine->price = $price;
                    if ($dosage) $medicine->dosage = $dosage;
                    if (!$medicine->exists) {
                        $medicine->stock_quantity = 0;
                        $medicine->low_stock_threshold = 10;
                    }
                    $medicine->save();
                }

                // 2. Sync LAB TESTS (Laboratory)
                if ($type === 'Examen') {
                    $code = $item['code'] ?? strtoupper(substr(str_replace(' ', '', $label), 0, 4));
                    $found = false;
                    foreach ($labTests as &$test) {
                        if ($test['label'] === $label || (isset($test['code']) && $test['code'] === $code)) {
                            $test['price'] = $price;
                            $test['label'] = $label;
                            $test['code'] = $code;
                            $found = true;
                            break;
                        }
                    }
                    if (!$found) {
                        $labTests[] = ['code' => $code, 'label' => $label, 'price' => $price];
                    }
                }

                // 3. Sync SPECIFIC PRICES (Reception / Consult / Soins)
                if ($type === 'Dossier') Setting::setValue('fiche_price', (string) $price);
                if ($type === 'Consultation') Setting::setValue('consultation_price', (string) $price);
                if ($type === 'Soins') Setting::setValue('soins_price', (string) $price);
                if ($type === 'Maternité' || $type === 'Maternite') Setting::setValue('maternity_prenatal_fee', (string) $price);
                if ($type === 'Accouchement') Setting::setValue('maternity_delivery_fee', (string) $price);
            }

            // Save the synchronized lab catalog
            Setting::setValue('lab_tests_catalog', json_encode($labTests));
        }

        return response()->json([
            'message' => 'Paramètres mis à jour',
            'settings' => $saved,
        ]);
    }

    public function getBootstrap(Request $request)
    {
        $user = $request->user();
        \App\Models\Insurance::syncExpiredContracts();

        return response()->json([
            'stats' => $this->getDashboardStats($request),
            'users' => User::select('id', 'name', 'role', 'profile_picture', 'specialty')->get(),
            'patients' => \App\Models\Patient::with('insurance:id,name,status,contract_end_date')
                ->select('id', 'first_name', 'last_name', 'post_name', 'is_insured', 'insurance_id', 'insurance_code', 'contact_info', 'birth_year', 'pathology', 'gender', 'created_at')
                ->latest()
                ->take(200)
                ->get(),
            'messages' => $this->getMessages($request)->original,
            'insurances' => \App\Models\Insurance::select('id', 'name', 'email', 'status', 'contract_date', 'contract_end_date', 'contract_type', 'monthly_flat_fee', 'contact_info')->get(),
            'server_time' => now()->toDateTimeString()
        ]);
    }

    public function getPatientRecords(Request $request)
    {
        $query = \App\Models\Patient::with('insurance:id,name,status,contract_end_date')
            ->select('id', 'first_name', 'last_name', 'post_name', 'is_insured', 'insurance_id', 'insurance_code', 'contact_info', 'birth_year', 'pathology', 'gender', 'created_at');

        if ($request->filled('q')) {
            $search = trim($request->string('q')->toString());
            $query->where(function ($inner) use ($search) {
                $inner->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('post_name', 'like', "%{$search}%")
                    ->orWhere('insurance_code', 'like', "%{$search}%")
                    ->orWhere('contact_info', 'like', "%{$search}%");
            });
        }

        if ($request->filled('birth_year')) {
            $query->where('birth_year', (int) $request->birth_year);
        }

        return response()->json($query->latest()->limit(min($request->integer('limit', 500), 1000))->get());
    }

    public function updatePatientRecord(Request $request, $id)
    {
        $patient = \App\Models\Patient::findOrFail($id);
        $data = $request->validate([
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'post_name' => 'nullable|string|max:255',
            'birth_year' => 'nullable|integer|min:1900|max:2100',
            'pathology' => 'nullable|string|max:255',
            'gender' => 'nullable|string|max:10',
            'contact_info' => 'nullable|string',
            'is_insured' => 'sometimes|boolean',
            'insurance_id' => 'nullable|exists:insurances,id',
            'insurance_code' => 'nullable|string',
        ]);

        if (($data['is_insured'] ?? false) && !empty($data['insurance_id'])) {
            $insurance = \App\Models\Insurance::find($data['insurance_id']);
            $insurance?->markExpiredIfNeeded();
            if (!$insurance || !$insurance->is_operational) {
                return response()->json(['message' => "Cette assurance n'est pas opérationnelle pour les patients."], 422);
            }
        }

        $patient->update($data);

        return response()->json([
            'message' => 'Dossier patient mis à jour.',
            'patient' => $patient->fresh('insurance'),
        ]);
    }

    public function deletePatientRecord($id)
    {
        $patient = \App\Models\Patient::findOrFail($id);
        $patient->delete();

        return response()->json(['message' => 'Dossier patient supprimé.']);
    }

    public function exportHospitalData(Request $request)
    {
        \App\Models\Insurance::syncExpiredContracts();

        $payload = [
            'generated_at' => now()->toIso8601String(),
            'patients' => \App\Models\Patient::with('insurance:id,name,status,contract_end_date')->latest()->get(),
            'insurances' => \App\Models\Insurance::withCount(['patients', 'insuredMembers'])->orderBy('name')->get(),
            'invoices_summary' => \App\Models\Invoice::selectRaw('service, status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total')
                ->groupBy('service', 'status')
                ->get(),
        ];

        if ($request->query('download') === '1') {
            $filename = 'rehoboth-data-' . now()->format('Ymd-His') . '.json';
            return Response::make(json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), 200, [
                'Content-Type' => 'application/json',
                'Content-Disposition' => "attachment; filename={$filename}",
            ]);
        }

        return response()->json($payload);
    }

    private function normalizeInsuranceDates(array &$data)
    {
        foreach (['contract_date', 'contract_end_date'] as $field) {
            if (array_key_exists($field, $data) && filled($data[$field])) {
                try {
                    $data[$field] = str_contains($data[$field], '/')
                        ? \Carbon\Carbon::createFromFormat('d/m/Y', $data[$field])->format('Y-m-d')
                        : \Carbon\Carbon::parse($data[$field])->format('Y-m-d');
                } catch (\Exception $e) {
                    return response()->json(['message' => 'Format de date invalide (Attendu: JJ/MM/AAAA)'], 422);
                }
            } else {
                $data[$field] = null;
            }
        }

        if (!empty($data['contract_date']) && !empty($data['contract_end_date']) && $data['contract_end_date'] < $data['contract_date']) {
            return response()->json(['message' => 'La date de fin doit être postérieure à la date de début.'], 422);
        }

        return null;
    }

    private function getDashboardStats(Request $request)
    {
        $period = $request->get('period', 'day');
        $cacheKey = "admin_stats_{$period}";

        // Cache for 1 minute to avoid heavy DB hits on every click
        return \Cache::remember($cacheKey, 60, function () use ($request) {
            return $this->buildDashboardStats($request);
        });
    }
}
