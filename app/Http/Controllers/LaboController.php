<?php

namespace App\Http\Controllers;

use App\Models\Visit;
use App\Traits\NotifiesUsers;
use Illuminate\Http\Request;

class LaboController extends Controller
{
    use NotifiesUsers;
    public function getPendingOrders(Request $request)
    {
        $perPage = min(max($request->integer('per_page', 30), 10), 100);

        $orders = \App\Models\LabOrder::with([
                'patient:id,first_name,last_name,post_name,is_insured,insurance_id',
                'doctor:id,name,specialty',
                'items:id,lab_order_id,test_name,category,status,result',
            ])
            ->where('status', 'pending')
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);
            
        return response()->json($orders);
    }

    public function updateResults(Request $request, $id)
    {
        $data = $request->validate([
            'results' => 'required|string',
            'item_results' => 'nullable|array', // results for individual items
        ]);

        $visit = Visit::with('patient:id,first_name,last_name,is_insured,insurance_id')->findOrFail($id);
        $visit->lab_results = $data['results'];
        $visit->lab_order_status = 'completed';
        
        // Append results to clinical notes
        $visit->complaints_notes .= ($visit->complaints_notes ? "\n" : '') . '[LABORATOIRE] ' . $data['results'];

        // NEW: Update structured LabOrder
        $labOrder = \App\Models\LabOrder::where('visit_id', $visit->id)->where('status', 'pending')->first();
        if ($labOrder) {
            $labOrder->status = 'completed';
            $labOrder->clinical_notes = trim(($labOrder->clinical_notes ? $labOrder->clinical_notes . "\n" : '') . '[RESULTATS] ' . $data['results']);
            $labOrder->save();

            if (isset($data['item_results'])) {
                foreach ($data['item_results'] as $itemRes) {
                    $item = $labOrder->items()->find($itemRes['id']);
                    if ($item) {
                        $item->result = $itemRes['value'];
                        $item->status = 'completed';
                        $item->save();
                    }
                }
            } else {
                // Mark all items as completed if no specific results provided
                $labOrder->items()->update(['status' => 'completed']);
            }
        }

        // Logic based on insurance
        $isInsured = $visit->patient?->is_insured;
        
        if ($isInsured) {
            $visit->current_service = 'medecin';
            $visit->status = 'pending';
            $message = 'Résultats enregistrés. Dossier retourné au médecin (Assuré).';
            
            if ($visit->doctor_id) {
                $this->notifyUser($visit->doctor_id, '🔬 Résultats Labo Prêts', "Les résultats d'analyses pour {$visit->patient->first_name} {$visit->patient->last_name} (Assuré) sont disponibles.", ['visit_id' => $visit->id]);
            } else {
                $this->notifyRole('medecin', '🔬 Résultats Labo Prêts', "Les résultats d'analyses pour {$visit->patient->first_name} {$visit->patient->last_name} (Assuré) sont disponibles.", ['visit_id' => $visit->id]);
            }
        } else {
            $visit->current_service = 'caisse';
            $visit->status = 'pending';
            $message = 'Résultats enregistrés. Dossier envoyé à la caisse pour régularisation.';
            $this->notifyRole('caisse', '💰 Paiement Labo', "Les examens pour {$visit->patient->first_name} {$visit->patient->last_name} sont terminés. Paiement requis avant retour chez le médecin.", ['visit_id' => $visit->id]);
        }

        $visit->save();

        return response()->json([
            'message' => $message,
            'visit' => $visit->fresh(['patient'])
        ]);
    }

    public function completedToday(Request $request)
    {
        $today = now()->startOfDay();
        $tomorrow = $today->copy()->addDay();
        $perPage = min(max($request->integer('per_page', 30), 10), 100);

        $visits = Visit::with(['patient:id,first_name,last_name,post_name'])
            ->where('updated_at', '>=', $today)
            ->where('updated_at', '<', $tomorrow)
            ->where('current_service', '!=', 'labo')
            ->whereNotNull('lab_results')
            ->orderBy('updated_at', 'desc')
            ->paginate($perPage);

        return response()->json($visits);
    }

    public function allHistory(Request $request)
    {
        $perPage = min(max($request->integer('per_page', 50), 10), 150);

        $visits = Visit::with(['patient:id,first_name,last_name,post_name'])
            ->where('current_service', '!=', 'labo')
            ->whereNotNull('lab_results')
            ->orderBy('updated_at', 'desc')
            ->limit($request->boolean('all') ? 500 : $perPage)
            ->get();

        return response()->json($visits);
    }
}
