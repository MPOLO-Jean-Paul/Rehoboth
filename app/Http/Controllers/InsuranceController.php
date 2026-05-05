<?php

namespace App\Http\Controllers;

use App\Models\Insurance;
use App\Models\Invoice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InsuranceController extends Controller
{
    /**
     * Liste toutes les assurances
     */
    public function index()
    {
        return response()->json(Insurance::orderBy('name')->get());
    }

    /**
     * Rapport mensuel détaillé pour une assurance
     */
    public function getMonthlyReport(Request $request, $id)
    {
        $insurance = Insurance::findOrFail($id);
        $month = $request->query('month', now()->month);
        $year = $request->query('year', now()->year);

        $invoices = Invoice::with(['patient', 'visit'])
            ->where('insurance_id', $id)
            ->whereMonth('created_at', $month)
            ->whereYear('created_at', $year)
            ->whereIn('status', ['paid', 'insurance_billed', 'settled'])
            ->orderBy('created_at', 'asc')
            ->get();

        $totalAmount = $invoices->sum('amount');
        $settledAmount = $invoices->where('status', 'settled')->sum('amount');
        $pendingAmount = $totalAmount - $settledAmount;

        $summary = [
            'total_amount' => $totalAmount,
            'settled_amount' => $settledAmount,
            'pending_amount' => $pendingAmount,
            'invoice_count' => $invoices->count(),
            'period' => date('F Y', mktime(0, 0, 0, $month, 10, $year)),
            'insurance_name' => $insurance->name,
            'insurance_email' => $insurance->email,
        ];

        return response()->json([
            'insurance' => $insurance,
            'summary' => $summary,
            'invoices' => $invoices
        ]);
    }

    /**
     * Marquer un ensemble de factures comme payées par l'assurance
     */
    public function settleInvoices(Request $request, $id)
    {
        $data = $request->validate([
            'invoice_ids' => 'required|array',
            'invoice_ids.*' => 'exists:invoices,id',
            'payment_reference' => 'required|string',
        ]);

        DB::transaction(function () use ($data, $id) {
            Invoice::whereIn('id', $data['invoice_ids'])
                ->where('insurance_id', $id)
                ->update([
                    'status' => 'settled',
                    'payment_method' => 'bank_transfer',
                    'payment_phone' => $data['payment_reference'],
                ]);
        });

        return response()->json(['message' => 'Les factures ont été marquées comme réglées par l\'assurance.']);
    }

    /**
     * Envoi simulé du rapport mensuel
     */
    public function sendMonthlyReport(Request $request, $id)
    {
        $insurance = Insurance::findOrFail($id);
        
        if (!$insurance->email) {
            return response()->json(['message' => 'Aucune adresse e-mail configurée pour cette assurance.'], 422);
        }

        // Simulation d'envoi d'e-mail
        // \Mail::to($insurance->email)->send(new \App\Mail\MonthlyInsuranceReport($insurance));

        return response()->json([
            'message' => "Le relevé mensuel a été envoyé avec succès à {$insurance->email}."
        ]);
    }
}
