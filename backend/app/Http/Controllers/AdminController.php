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
}
