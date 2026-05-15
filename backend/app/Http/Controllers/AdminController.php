<?php

namespace App\Http\Controllers;

use App\Models\StaffMessage;
use App\Models\User;
use App\Models\Patient;
use App\Models\Visit;
use App\Models\Invoice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Models\Medicine;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    public function bootstrap(Request $request)
    {
        try {
            $period = $request->query('period', 'day');
            $now = Carbon::now();
            
            $periodLabel = '';
            if ($period === 'week') {
                $startDate = Carbon::now()->startOfWeek();
                $periodLabel = "Semaine active (du " . $startDate->format('d/m') . " au " . Carbon::now()->endOfWeek()->format('d/m') . ")";
            } elseif ($period === 'month') {
                $startDate = Carbon::now()->startOfMonth();
                $periodLabel = "Mois actif : " . ucfirst($startDate->translatedFormat('F Y'));
            } else {
                $startDate = Carbon::today();
                $periodLabel = "Aujourd'hui, " . $startDate->translatedFormat('d F Y');
            }

            $stats = [
                'period' => $period,
                'period_label' => $periodLabel,
                'total_patients_period' => Patient::where('created_at', '>=', $startDate)->count(),
                'total_visits_period' => Visit::where('created_at', '>=', $startDate)->count(),
                'revenue_period' => Invoice::where('created_at', '>=', $startDate)->where('status', 'paid')->sum('amount'),
                'revenue_by_service' => Visit::join('invoices', 'visits.id', '=', 'invoices.visit_id')
                                            ->selectRaw('visits.current_service as service, sum(invoices.amount) as total')
                                            ->where('invoices.status', 'paid')
                                            ->where('invoices.created_at', '>=', $startDate)
                                            ->groupBy('visits.current_service')
                                            ->get(),
                'top_insurances' => Patient::selectRaw('insurance_company as name, count(*) as count')
                                            ->where('is_insured', true)
                                            ->whereNotNull('insurance_company')
                                            ->groupBy('insurance_company')
                                            ->orderByDesc('count')
                                            ->limit(5)
                                            ->get(),
                'low_stock_count' => Medicine::whereRaw('stock_quantity <= low_stock_threshold')->count(),
                'lab_pending_count' => Visit::where('current_service', 'labo')->where('status', '!=', 'completed')->count()
            ];

            return response()->json([
                'stats' => $stats,
                'users' => User::all(),
                'patients' => Patient::latest()->limit(500)->get(),
                'insurances' => Patient::where('is_insured', true)
                                        ->whereNotNull('insurance_company')
                                        ->select('insurance_company')
                                        ->distinct()
                                        ->get()
                                        ->map(function($i) {
                                            return ['name' => $i->insurance_company];
                                        }),
                'messages' => StaffMessage::with('sender:id,name,role')->latest()->limit(50)->get()
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Erreur lors du chargement des données: ' . $e->getMessage()], 500);
        }
    }

    public function dashboard(Request $request)
    {
        try {
            $today = Carbon::today();
            
            $stats = [
                'total_patients_today' => Patient::whereDate('created_at', $today)->count(),
                'total_visits_today' => Visit::whereDate('created_at', $today)->count(),
                'revenue_today' => Invoice::whereDate('created_at', $today)->where('status', 'paid')->sum('amount'),
                'visits_by_service' => Visit::selectRaw('current_service, count(*) as count')
                                            ->where('status', '!=', 'completed')
                                            ->groupBy('current_service')
                                            ->get(),
                'top_insurances' => Patient::selectRaw('insurance_company, count(*) as count')
                                            ->where('is_insured', true)
                                            ->whereNotNull('insurance_company')
                                            ->groupBy('insurance_company')
                                            ->orderByDesc('count')
                                            ->limit(3)
                                            ->get(),
                'low_stock_medicines' => Medicine::whereRaw('stock_quantity <= low_stock_threshold')
                                                 ->select('name', 'stock_quantity')
                                                 ->get(),
                'lab_pending_count' => Visit::where('current_service', 'labo')->count()
            ];
            
            return response()->json($stats);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Erreur lors du calcul des statistiques du tableau de bord: ' . $e->getMessage()], 500);
        }
    }

    public function getMessages()
    {
        return response()->json(StaffMessage::with('sender:id,name,role')->latest()->get());
    }

    public function broadcastMail(Request $request)
    {
        $validated = $request->validate([
            'subject' => 'required|string',
            'message' => 'required|string'
        ]);

        StaffMessage::create([
            'sender_id' => $request->user()->id,
            'subject' => $validated['subject'],
            'message' => $validated['message'],
            'is_read' => false,
        ]);

        return response()->json(['message' => 'Message diffusé avec succès à tous les agents.']);
    }

    public function getUsers()
    {
        return response()->json(User::all());
    }

    public function createUser(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'email' => 'required|email|unique:users',
            'password' => 'required|min:6',
            'role' => 'required|string|in:admin,reception,caisse,medecin,labo,soins,pharmacie'
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role' => $data['role']
        ]);

        return response()->json(['message' => 'Personnel créé', 'user' => $user]);
    }

    public function updateUser(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $data = $request->validate([
            'name' => 'required|string',
            'email' => 'required|email|unique:users,email,'.$id,
            'role' => 'required|string|in:admin,reception,caisse,medecin,labo,soins,pharmacie'
        ]);

        $user->update([
            'name' => $data['name'],
            'email' => $data['email'],
            'role' => $data['role']
        ]);

        return response()->json(['message' => 'Utilisateur mis à jour', 'user' => $user]);
    }

    public function deleteUser(Request $request, $id)
    {
        $password = $request->input('password');
        if (!$password || !Hash::check($password, $request->user()->password)) {
            return response()->json(['message' => 'Mot de passe incorrect ou manquant.'], 403);
        }

        $user = User::findOrFail($id);
        
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Vous ne pouvez pas supprimer votre propre compte.'], 403);
        }

        $user->delete();
        return response()->json(['message' => 'Utilisateur supprimé avec succès.']);
    }

    public function getSettings()
    {
        return response()->json(Setting::all());
    }

    public function updateSettingsBulk(Request $request)
    {
        $settings = $request->input('settings', []);
        
        foreach ($settings as $key => $value) {
            Setting::updateOrCreate(
                ['key' => $key],
                ['value' => is_array($value) ? json_encode($value) : $value]
            );
        }

        return response()->json(['message' => 'Paramètres mis à jour avec succès.']);
    }

    public function getCatalog()
    {
        try {
            $labTests = Setting::where('key', 'lab_tests_catalog')->first();
            $otherPrices = Setting::where('key', 'other_prices_catalog')->first();
            $medicines = Medicine::orderBy('name')->get();

            return response()->json([
                'lab_tests' => $labTests ? json_decode($labTests->value, true) : [],
                'other_prices' => $otherPrices ? json_decode($otherPrices->value, true) : [],
                'medicines' => $medicines
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Erreur lors de la récupération du catalogue: ' . $e->getMessage()], 500);
        }
    }

    public function getPatientRecords(Request $request)
    {
        try {
            $query = Patient::query();

            if ($request->has('q')) {
                $q = $request->query('q');
                $query->where(function($f) use ($q) {
                    $f->where('first_name', 'like', "%$q%")
                      ->orWhere('last_name', 'like', "%$q%")
                      ->orWhere('contact_info', 'like', "%$q%");
                });
            }

            return response()->json($query->latest()->limit(500)->get());
        } catch (\Exception $e) {
            return response()->json(['message' => 'Erreur lors de la récupération des dossiers patients: ' . $e->getMessage()], 500);
        }
    }

    public function updatePatientRecord(Request $request, $id)
    {
        $patient = Patient::findOrFail($id);
        $data = $request->validate([
            'first_name' => 'sometimes|string',
            'last_name' => 'sometimes|string',
            'contact_info' => 'nullable|string',
            'is_insured' => 'sometimes|boolean',
            'insurance_company' => 'nullable|string',
            'insurance_code' => 'nullable|string',
        ]);

        $patient->update($data);
        return response()->json(['message' => 'Dossier patient mis à jour', 'patient' => $patient]);
    }

    public function deletePatientRecord(Request $request, $id)
    {
        $password = $request->input('password');
        if (!$password || !Hash::check($password, $request->user()->password)) {
            return response()->json(['message' => 'Mot de passe admin requis pour cette action.'], 403);
        }

        $patient = Patient::findOrFail($id);
        
        // Check for dependencies (visits)
        if ($patient->visits()->exists()) {
             return response()->json(['message' => 'Impossible de supprimer un patient ayant des visites enregistrées.'], 409);
        }

        $patient->delete();
        return response()->json(['message' => 'Dossier patient supprimé avec succès.']);
    }

    public function exportHospitalData()
    {
        return response()->json([
            'generated_at' => now(),
            'patients' => Patient::with('visits')->get(),
            'insurances' => Patient::where('is_insured', true)->select('insurance_company')->distinct()->get(),
            'summary' => [
                'total_patients' => Patient::count(),
                'insured_patients' => Patient::where('is_insured', true)->count(),
            ]
        ]);
    }

    public function resetAll(Request $request)
    {
        $password = $request->input('password');
        if (!Hash::check($password, $request->user()->password)) {
            return response()->json(['message' => 'Mot de passe administrateur incorrect.'], 403);
        }

        // This is destructive!
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        Patient::truncate();
        Visit::truncate();
        Invoice::truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        return response()->json(['message' => 'Toutes les données ont été réinitialisées.']);
    }

    public function resetService(Request $request)
    {
        $password = $request->input('password');
        if (!Hash::check($password, $request->user()->password)) {
            return response()->json(['message' => 'Mot de passe administrateur incorrect.'], 403);
        }

        $service = $request->input('service');
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        if ($service === 'reception' || $service === 'patients') {
            Patient::truncate();
            Visit::where('current_service', 'reception')->delete();
        } elseif ($service === 'pharmacie') {
            Medicine::truncate();
        } elseif ($service === 'labo') {
            Visit::where('current_service', 'labo')->delete();
        } elseif ($service === 'caisse') {
            Invoice::truncate();
        }
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        return response()->json(['message' => "Données du service " . strtoupper($service) . " réinitialisées."]);
    }
}
