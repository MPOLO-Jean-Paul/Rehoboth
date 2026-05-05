<?php

namespace App\Http\Controllers;

use App\Models\Visit;
use Illuminate\Http\Request;

class LaboController extends Controller
{
    public function updateResults(Request $request, $id)
    {
        $data = $request->validate([
            'results' => 'required|string',
            'forward_to' => 'required|string|in:medecin,pharmacie,completed'
        ]);

        $visit = Visit::findOrFail($id);
        $visit->complaints_notes .= ($visit->complaints_notes ? "\n" : '') . '[LABORATOIRE] ' . $data['results'];
        $visit->current_service = $data['forward_to'];

        if ($data['forward_to'] === 'completed') {
            $visit->status = 'completed';
        }

        $visit->save();

        return response()->json([
            'message' => 'Résultats enregistrés. Dossier transféré vers: ' . $data['forward_to'],
            'visit' => $visit
        ]);
    }
}
