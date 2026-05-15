<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Visit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InvoiceController extends Controller
{
    public function index(Request $request)
    {
        try {
            $invoices = Invoice::with(['patient', 'visit'])
                ->whereIn('status', ['unpaid', 'insurance_billed'])
                ->orderBy('created_at', 'desc')
                ->get();
                
            return response()->json($invoices);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Erreur lors du chargement des factures: ' . $e->getMessage()], 500);
        }
    }

    public function pay(Request $request, $id)
    {
        return DB::transaction(function () use ($id) {
            $invoice = Invoice::with('visit')->lockForUpdate()->findOrFail($id);

            if ($invoice->status === 'paid') {
                return response()->json([
                    'message' => 'Cette facture est déjà payée.',
                    'invoice' => $invoice
                ], 409);
            }

            $invoice->status = 'paid';
            $invoice->save();

            if ($invoice->visit) {
                $invoice->visit->current_service = 'medecin';
                if ($invoice->visit->status !== 'completed') {
                    $invoice->visit->status = 'pending';
                }
                $invoice->visit->save();
            }

            return response()->json([
                'message' => 'Facture validée et payée. Le dossier a été transféré au médecin.',
                'invoice' => $invoice
            ]);
        });
    }
}
