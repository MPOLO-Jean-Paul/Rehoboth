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
use Carbon\Carbon;

class AdminController extends Controller
{
    public function bootstrap(Request $request)
    {
        $period = $request->query('period', 'day');
        $now = Carbon::now();
        
        if ($period === 'week') {
            $startDate = Carbon::now()->startOfWeek();
        } elseif ($period === 'month') {
            $startDate = Carbon::now()->startOfMonth();
        } else {
            $startDate = Carbon::today();
        }

        $stats = [
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
            'insurances' => Patient::where('is_insured', true)->select('insurance_company')->distinct()->get()->map(function($i) {
                return ['name' => $i->insurance_company];
            }),
            'messages' => StaffMessage::with('sender:id,name,role')->latest()->limit(50)->get()
        ]);
    }

    public function dashboard(Request $request)
    {
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

    public function deleteUser($id)
    {
        $user = User::findOrFail($id);
        
        // Prevent deleting the last admin if needed, but for now simple delete
        $user->delete();

        return response()->json(['message' => 'Utilisateur supprimé']);
    }

    public function getCatalog()
    {
        // Simple mock or fetch from a real 'catalog' table if it exists.
        // For now, based on previous edits, we can return some common ones or empty.
        return response()->json([
            'lab_tests' => [
                ['code' => 'GE', 'label' => 'Goutte Épaisse', 'price' => 5000],
                ['code' => 'HEM', 'label' => 'Hémogramme', 'price' => 15000],
                ['code' => 'GLY', 'label' => 'Glycémie', 'price' => 3000],
                ['code' => 'WID', 'label' => 'Widal', 'price' => 7000],
            ]
        ]);
    }

    public function fetchDataRecords()
    {
        return response()->json(Patient::latest()->get());
    }
}
