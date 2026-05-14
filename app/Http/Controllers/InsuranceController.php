<?php

namespace App\Http\Controllers;

use App\Models\Insurance;
use App\Models\Invoice;
use App\Mail\MonthlyInsuranceReport;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class InsuranceController extends Controller
{
    /**
     * Liste toutes les assurances
     */
    public function index()
    {
        Insurance::syncExpiredContracts();
        return response()->json(Insurance::orderBy('name')->get());
    }

    /**
     * Rapport mensuel détaillé pour une assurance
     */
    public function getMonthlyReport(Request $request, $id)
    {
        $insurance = Insurance::findOrFail($id);
        $month = (int) $request->query('month', now()->month);
        $year = (int) $request->query('year', now()->year);
        $periodStart = Carbon::create($year, $month, 1)->startOfMonth();
        $periodEnd = $periodStart->copy()->endOfMonth();

        $invoices = Invoice::with(['patient', 'visit'])
            ->where('insurance_id', $id)
            ->whereBetween('created_at', [$periodStart, $periodEnd])
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
            'period' => $periodStart->translatedFormat('F Y'),
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
     * Envoi réel du rapport mensuel
     */
    public function sendMonthlyReport(Request $request, $id)
    {
        $insurance = Insurance::findOrFail($id);
        $month = (int) $request->input('month', now()->month);
        $year = (int) $request->input('year', now()->year);
        $periodStart = Carbon::create($year, $month, 1)->startOfMonth();
        $periodEnd = $periodStart->copy()->endOfMonth();
        
        if (!$insurance->email) {
            return response()->json(['message' => 'Aucune adresse e-mail configurée pour cette assurance.'], 422);
        }

        $invoices = Invoice::with(['patient', 'visit'])
            ->where('insurance_id', $id)
            ->whereBetween('created_at', [$periodStart, $periodEnd])
            ->whereIn('status', ['paid', 'insurance_billed', 'settled'])
            ->orderBy('created_at', 'asc')
            ->get();

        if ($invoices->isEmpty()) {
            return response()->json([
                'message' => "Aucune facture à envoyer pour {$periodStart->translatedFormat('F Y')}."
            ], 422);
        }

        Mail::to($insurance->email)
            ->send(new MonthlyInsuranceReport($insurance, $periodStart->translatedFormat('F Y'), $invoices));

        return response()->json([
            'message' => "Le relevé mensuel a été envoyé avec succès à {$insurance->email}."
        ]);
    }
}
