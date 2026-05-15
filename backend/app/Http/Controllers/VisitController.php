<?php

namespace App\Http\Controllers;

use App\Models\Visit;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class VisitController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $role = $user->role;

        $query = Visit::with(['patient', 'invoice']);

        if ($role !== 'admin') {
            $query->where('current_service', $role);
        }

        return response()->json($query->orderBy('updated_at', 'desc')->get());
    }

    public function forward(Request $request, $id)
    {
        $validated = $request->validate([
            'next_service' => 'required|string|in:reception,caisse,medecin,labo,soins,pharmacie,completed',
            'notes' => 'nullable|string'
        ]);

        $visit = Visit::findOrFail($id);
        $user = $request->user();

        if ($user->role !== 'admin' && $visit->current_service !== $user->role) {
            return response()->json(['message' => 'Vous ne pouvez modifier qu\'une visite de votre service.'], 403);
        }

        if ($visit->status === 'completed') {
            return response()->json(['message' => 'Cette visite est déjà terminée.'], 409);
        }

        $visit->current_service = $validated['next_service'];
        if ($validated['next_service'] === 'completed') {
            $visit->status = 'completed';
        }

        if (!empty($validated['notes'])) {
            $prefix = $visit->complaints_notes ? "\n" : '';
            $visit->complaints_notes .= $prefix . '[' . strtoupper($user->role) . '] ' . $validated['notes'];
        }

        $visit->save();

        return response()->json([
            'message' => 'Dossier transféré vers: ' . $validated['next_service'],
            'visit' => $visit
        ]);
    }

    public function myToday(Request $request)
    {
        $user = $request->user();
        return response()->json(
            Visit::with(['patient', 'invoice'])
                ->whereDate('updated_at', now())
                ->where('status', 'completed')
                ->latest()
                ->get()
        );
    }
}
